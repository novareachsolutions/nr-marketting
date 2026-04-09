import {
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { WordPressService } from '../wordpress/wordpress.service';
import { GitHubService } from '../github/github.service';

interface FixResult {
  fixed: boolean;
  method: 'wordpress' | 'github' | 'manual';
  details: string;
  prUrl?: string;
}

interface AiFixResult {
  title?: string;
  metaDescription?: string;
  h1?: string;
  content?: string;
  altText?: string;
}

const FIXABLE_ISSUE_TYPES = [
  'MISSING_TITLE',
  'MISSING_META_DESCRIPTION',
  'MISSING_H1',
  'TITLE_TOO_LONG',
  'TITLE_TOO_SHORT',
  'META_DESCRIPTION_TOO_LONG',
  'META_DESCRIPTION_TOO_SHORT',
  'IMAGE_MISSING_ALT',
  'LOW_WORD_COUNT',
  'MISSING_CANONICAL',
  'MISSING_STRUCTURED_DATA',
  'MISSING_OG_IMAGE',
  'NO_DIRECT_ANSWERS',
  'WEAK_EEAT_SIGNALS',
];

@Injectable()
export class AutoFixService {
  private readonly logger = new Logger(AutoFixService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wordpressService: WordPressService,
    @Optional()
    @Inject(forwardRef(() => GitHubService))
    private readonly githubService: GitHubService | null,
  ) {}

  /**
   * Main entry point: fix a crawl issue.
   */
  async fixIssue(projectId: string, issueId: string): Promise<FixResult> {
    const issue = await this.prisma.crawlIssue.findUnique({
      where: { id: issueId },
      include: {
        crawlPage: {
          include: {
            crawlJob: {
              include: {
                project: true,
              },
            },
          },
        },
      },
    });

    if (!issue) {
      throw new NotFoundException(`Issue ${issueId} not found`);
    }

    const project = issue.crawlPage.crawlJob.project;

    if (project.id !== projectId) {
      throw new NotFoundException(`Issue ${issueId} not found in this project`);
    }

    if (!FIXABLE_ISSUE_TYPES.includes(issue.type)) {
      return {
        fixed: false,
        method: 'manual',
        details: `Issue type "${issue.type}" cannot be auto-fixed. ${issue.suggestion ?? 'Please fix manually.'}`,
      };
    }

    switch (project.sourceType) {
      case 'WORDPRESS':
        return this.fixViaWordPress(project, issue, issue.crawlPage);
      case 'GITHUB':
        return this.fixViaGitHub(project, issue, issue.crawlPage);
      case 'MANUAL':
      default:
        return {
          fixed: false,
          method: 'manual',
          details: issue.suggestion ?? 'No auto-fix available for manual projects. Please fix this issue directly on your site.',
        };
    }
  }

  /**
   * Preview what the fix would look like without applying it.
   */
  async previewFix(
    projectId: string,
    issueId: string,
  ): Promise<{ issueType: string; currentValue: string; suggestedFix: AiFixResult; method: string }> {
    const issue = await this.prisma.crawlIssue.findUnique({
      where: { id: issueId },
      include: {
        crawlPage: {
          include: {
            crawlJob: {
              include: {
                project: true,
              },
            },
          },
        },
      },
    });

    if (!issue) {
      throw new NotFoundException(`Issue ${issueId} not found`);
    }

    const project = issue.crawlPage.crawlJob.project;

    if (project.id !== projectId) {
      throw new NotFoundException(`Issue ${issueId} not found in this project`);
    }

    const page = issue.crawlPage;
    const pageData = {
      url: page.url,
      title: page.title ?? '',
      metaDescription: page.metaDescription ?? '',
      h1: page.h1 ?? '',
      wordCount: page.wordCount,
    };

    const suggestedFix = await this.generateFixWithAI(issue.type, pageData);

    let currentValue = '';
    switch (issue.type) {
      case 'MISSING_TITLE':
      case 'TITLE_TOO_LONG':
      case 'TITLE_TOO_SHORT':
        currentValue = page.title ?? '(empty)';
        break;
      case 'MISSING_META_DESCRIPTION':
      case 'META_DESCRIPTION_TOO_LONG':
      case 'META_DESCRIPTION_TOO_SHORT':
        currentValue = page.metaDescription ?? '(empty)';
        break;
      case 'MISSING_H1':
        currentValue = page.h1 ?? '(empty)';
        break;
      default:
        currentValue = '(see page)';
    }

    return {
      issueType: issue.type,
      currentValue,
      suggestedFix,
      method: project.sourceType.toLowerCase(),
    };
  }

  /**
   * Fix an issue via WordPress REST API.
   */
  private async fixViaWordPress(
    project: any,
    issue: any,
    page: any,
  ): Promise<FixResult> {
    try {
      // Extract slug from the page URL
      const slug = this.extractSlugFromUrl(page.url);

      // Get the WP page by slug
      const wpPage = await this.wordpressService.getPageBySlug(
        project.id,
        slug,
      );

      // Generate fix with AI
      const pageData = {
        url: page.url,
        title: page.title ?? wpPage.title?.rendered ?? '',
        metaDescription: page.metaDescription ?? '',
        h1: page.h1 ?? '',
        wordCount: page.wordCount,
        content: wpPage.content?.rendered ?? '',
      };

      const fix = await this.generateFixWithAI(issue.type, pageData);

      // Build the meta update
      const metaUpdate: { title?: string; metaDescription?: string; content?: string } = {};

      if (fix.title) metaUpdate.title = fix.title;
      if (fix.metaDescription) metaUpdate.metaDescription = fix.metaDescription;
      if (fix.content) metaUpdate.content = fix.content;

      // Apply the fix via WordPress
      await this.wordpressService.updatePageMeta(
        project.id,
        wpPage.id,
        metaUpdate,
      );

      return {
        fixed: true,
        method: 'wordpress',
        details: `Successfully fixed "${issue.type}" on ${page.url} via WordPress API.`,
      };
    } catch (error) {
      this.logger.error(
        `WordPress fix failed for issue ${issue.id}: ${(error as any).message}`,
      );
      return {
        fixed: false,
        method: 'wordpress',
        details: `Failed to fix via WordPress: ${(error as any).message}`,
      };
    }
  }

  /**
   * Fix an issue via GitHub (create a PR with the fix).
   */
  private async fixViaGitHub(
    project: any,
    issue: any,
    page: any,
  ): Promise<FixResult> {
    if (!this.githubService) {
      return {
        fixed: false,
        method: 'github',
        details: 'GitHub integration is not available. Please connect your GitHub repository.',
      };
    }

    try {
      // Get the full repo file tree and find the best matching source file
      const urlPath = new URL(page.url).pathname.replace(/^\/|\/$/g, '');
      const allFiles = await this.githubService.getRepoTree(project.id);

      const filePath = this.findBestSourceFile(urlPath, allFiles);

      if (!filePath) {
        return {
          fixed: false,
          method: 'github',
          details: `Could not find the source file for ${page.url} in the repository. Files scanned: ${allFiles.length}`,
        };
      }

      let fileContent: string;
      try {
        const result = await this.githubService.getRepoFile(project.id, filePath);
        fileContent = result.content;
      } catch {
        return {
          fixed: false,
          method: 'github',
          details: `Found file ${filePath} but could not read its contents.`,
        };
      }

      // Generate fix with AI
      const pageData = {
        url: page.url,
        title: page.title ?? '',
        metaDescription: page.metaDescription ?? '',
        h1: page.h1 ?? '',
        wordCount: page.wordCount,
        content: fileContent,
      };

      const fixedContent = await this.generateFileFixWithAI(
        issue.type,
        issue.message,
        fileContent,
        pageData,
      );

      // Create a PR with the fix
      const branchName = `seo-fix/${issue.type.toLowerCase().replace(/_/g, '-')}-${Date.now()}`;
      const commitMessage = `fix(seo): ${issue.message}`;
      const prTitle = `[SEO Auto-Fix] ${issue.message}`;
      const prBody = [
        `## SEO Issue Fixed`,
        ``,
        `**Issue Type:** ${issue.type}`,
        `**Severity:** ${issue.severity}`,
        `**Page:** ${page.url}`,
        `**File:** ${filePath}`,
        ``,
        `### Details`,
        issue.message,
        ``,
        `### What was changed`,
        `AI-generated fix applied to \`${filePath}\` to resolve the SEO issue.`,
        ``,
        `---`,
        `*This PR was created automatically by the SEO Auto-Fix service.*`,
      ].join('\n');

      const prResult = await this.githubService.createFixPR(project.id, {
        branch: branchName,
        filePath,
        content: fixedContent,
        commitMessage,
        prTitle,
        prBody,
      });

      return {
        fixed: true,
        method: 'github',
        details: `Created pull request to fix "${issue.type}" on ${page.url}.`,
        prUrl: prResult,
      };
    } catch (error) {
      this.logger.error(
        `GitHub fix failed for issue ${issue.id}: ${(error as any).message}`,
      );
      return {
        fixed: false,
        method: 'github',
        details: `Failed to create GitHub PR: ${(error as any).message}`,
      };
    }
  }

  /**
   * Generate a fix using OpenAI GPT-4o-mini.
   */
  async generateFixWithAI(
    issueType: string,
    pageData: {
      url: string;
      title: string;
      metaDescription: string;
      h1: string;
      wordCount: number;
      content?: string;
    },
  ): Promise<AiFixResult> {
    const prompt = this.buildFixPrompt(issueType, pageData);

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content:
              'You are an SEO expert. Fix the following issue on this web page. Return ONLY valid JSON with the fix, no explanation. The JSON should have the relevant fields: "title", "metaDescription", "h1", "content", "altText" (include only the fields that need to change).',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      },
    );

    const aiContent = response.data.choices?.[0]?.message?.content ?? '{}';

    try {
      // Strip markdown code fences if present
      const cleaned = aiContent
        .replace(/^```json?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      return JSON.parse(cleaned);
    } catch {
      this.logger.warn(`Failed to parse AI response: ${aiContent}`);
      return {};
    }
  }

  /**
   * Generate a fixed version of an entire file using OpenAI.
   */
  private async generateFileFixWithAI(
    issueType: string,
    issueMessage: string,
    fileContent: string,
    pageData: {
      url: string;
      title: string;
      metaDescription: string;
      h1: string;
      wordCount: number;
    },
  ): Promise<string> {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content: [
              'You are an SEO expert. Fix the following SEO issue in this source file. Return ONLY the complete fixed file content, no explanation or code fences.',
              'For MISSING_CANONICAL: Add <link rel="canonical" href="..."> in the <head> section.',
              'For MISSING_STRUCTURED_DATA: Add a <script type="application/ld+json"> block with appropriate JSON-LD schema in the <head>.',
              'For MISSING_OG_IMAGE: Add <meta property="og:image" content="..."> in the <head>. Use "/og-image.png" as a default if no image URL is evident.',
              'For NO_DIRECT_ANSWERS: Add concise 40-60 word answer paragraphs right after question-phrased headings.',
              'For WEAK_EEAT_SIGNALS: Add a section with testimonials, credentials, experience, or trust signals.',
              'Only modify what is necessary to fix the issue. Preserve all existing code.',
            ].join(' '),
          },
          {
            role: 'user',
            content: [
              `SEO Issue: ${issueType} - ${issueMessage}`,
              `Page URL: ${pageData.url}`,
              `Current title: ${pageData.title || '(none)'}`,
              `Current meta description: ${pageData.metaDescription || '(none)'}`,
              `Current H1: ${pageData.h1 || '(none)'}`,
              ``,
              `File content:`,
              '```',
              fileContent,
              '```',
              ``,
              `Return the complete fixed file. Only modify what is necessary to fix the SEO issue.`,
            ].join('\n'),
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      },
    );

    const content = response.data.choices?.[0]?.message?.content ?? fileContent;

    // Strip code fences if present
    return content
      .replace(/^```[\w]*\s*\n?/i, '')
      .replace(/\n?\s*```$/i, '')
      .trim();
  }

  /**
   * Build the prompt for fixing an issue based on its type.
   */
  private buildFixPrompt(
    issueType: string,
    pageData: {
      url: string;
      title: string;
      metaDescription: string;
      h1: string;
      wordCount: number;
      content?: string;
    },
  ): string {
    const baseInfo = [
      `Page URL: ${pageData.url}`,
      `Current title: ${pageData.title || '(none)'}`,
      `Current meta description: ${pageData.metaDescription || '(none)'}`,
      `Current H1: ${pageData.h1 || '(none)'}`,
      `Word count: ${pageData.wordCount}`,
    ].join('\n');

    switch (issueType) {
      case 'MISSING_TITLE':
        return `${baseInfo}\n\nThe page is missing a title tag. Generate an SEO-optimized title (50-60 characters) based on the page URL and any available content. Return JSON: {"title": "..."}`;

      case 'TITLE_TOO_LONG':
        return `${baseInfo}\n\nThe page title is too long (over 60 characters). Shorten it to 50-60 characters while keeping it descriptive and SEO-friendly. Return JSON: {"title": "..."}`;

      case 'TITLE_TOO_SHORT':
        return `${baseInfo}\n\nThe page title is too short (under 30 characters). Expand it to 50-60 characters while keeping it relevant. Return JSON: {"title": "..."}`;

      case 'MISSING_META_DESCRIPTION':
        return `${baseInfo}\n\nThe page is missing a meta description. Generate an SEO-optimized meta description (120-155 characters) based on the page URL, title, and content. Return JSON: {"metaDescription": "..."}`;

      case 'META_DESCRIPTION_TOO_LONG':
        return `${baseInfo}\n\nThe meta description is too long (over 160 characters). Shorten it to 120-155 characters while preserving the key message. Return JSON: {"metaDescription": "..."}`;

      case 'META_DESCRIPTION_TOO_SHORT':
        return `${baseInfo}\n\nThe meta description is too short (under 70 characters). Expand it to 120-155 characters with relevant keywords. Return JSON: {"metaDescription": "..."}`;

      case 'MISSING_H1':
        return `${baseInfo}\n\nThe page is missing an H1 tag. Generate an appropriate H1 heading based on the page title and URL. Return JSON: {"h1": "..."}`;

      case 'IMAGE_MISSING_ALT':
        return `${baseInfo}\n\nImages on this page are missing alt text. Based on the page content and URL, suggest descriptive alt text. Return JSON: {"altText": "Descriptive alt text for the main image"}`;

      case 'LOW_WORD_COUNT':
        return `${baseInfo}\n\nThe page has low word count (${pageData.wordCount} words). Generate 2-3 additional paragraphs of relevant content to improve SEO. Return JSON: {"content": "...additional content..."}`;

      case 'MISSING_CANONICAL':
        return `${baseInfo}\n\nThe page is missing a canonical URL tag. Add a <link rel="canonical" href="..."> tag pointing to the canonical URL of this page. Return JSON: {"canonical": "${pageData.url}"}`;

      case 'MISSING_STRUCTURED_DATA':
        return `${baseInfo}\n\nThe page has no structured data (JSON-LD). Generate appropriate JSON-LD structured data for this page based on its URL, title, and content. For a portfolio/personal site use Person or WebPage schema. Return JSON: {"structuredData": {...}} where the value is valid JSON-LD.`;

      case 'MISSING_OG_IMAGE':
        return `${baseInfo}\n\nThe page has OG tags but is missing og:image. The fix should add an og:image meta tag. If no specific image URL is known, suggest a placeholder path like "/og-image.png" (1200x630px). Return JSON: {"ogImage": "/og-image.png"}`;

      case 'NO_DIRECT_ANSWERS':
        return `${baseInfo}\n\nNo concise answer paragraphs found after question headings. Add 40-60 word answer paragraphs directly below question-phrased headings. This is critical for featured snippets. Return JSON: {"content": "...content with question headings and concise answers..."}`;

      case 'WEAK_EEAT_SIGNALS':
        return `${baseInfo}\n\nPage lacks E-E-A-T trust signals (testimonials, awards, certifications). Add structured content that demonstrates expertise, experience, authoritativeness, and trustworthiness. Return JSON: {"content": "...content with trust signals section..."}`;

      default:
        return `${baseInfo}\n\nFix the following SEO issue: ${issueType}. Return the appropriate fix as JSON.`;
    }
  }

  /**
   * Extract a URL slug from a full URL.
   */
  private extractSlugFromUrl(url: string): string {
    try {
      const pathname = new URL(url).pathname;
      const parts = pathname.split('/').filter(Boolean);
      return parts[parts.length - 1] || '';
    } catch {
      return url.split('/').filter(Boolean).pop() || '';
    }
  }

  /**
   * Find the best matching source file from the repo tree for a given URL path.
   */
  private findBestSourceFile(urlPath: string, allFiles: string[]): string | null {
    // Only consider source files
    const sourceExts = ['.tsx', '.jsx', '.ts', '.js', '.html', '.astro', '.vue', '.svelte', '.md', '.mdx'];
    const sourceFiles = allFiles.filter((f) =>
      sourceExts.some((ext) => f.endsWith(ext)),
    );

    const slug = urlPath || 'index';

    // Priority 1: Exact match patterns (most specific first)
    const exactPatterns = urlPath
      ? [
          // Next.js app router
          `app/${urlPath}/page.tsx`, `app/${urlPath}/page.jsx`,
          `src/app/${urlPath}/page.tsx`, `src/app/${urlPath}/page.jsx`,
          // Next.js/Gatsby pages router
          `pages/${urlPath}.tsx`, `pages/${urlPath}.jsx`,
          `pages/${urlPath}/index.tsx`, `pages/${urlPath}/index.jsx`,
          `src/pages/${urlPath}.tsx`, `src/pages/${urlPath}.jsx`,
          `src/pages/${urlPath}/index.tsx`, `src/pages/${urlPath}/index.jsx`,
          // Direct files
          `${urlPath}.tsx`, `${urlPath}.jsx`, `${urlPath}.html`,
          `${urlPath}/index.tsx`, `${urlPath}/index.jsx`, `${urlPath}/index.html`,
          // Astro
          `src/pages/${urlPath}.astro`, `src/pages/${urlPath}/index.astro`,
          // Content files
          `content/${urlPath}.md`, `content/${urlPath}.mdx`,
        ]
      : [
          // Homepage / root
          'app/page.tsx', 'app/page.jsx',
          'src/app/page.tsx', 'src/app/page.jsx',
          'pages/index.tsx', 'pages/index.jsx',
          'src/pages/index.tsx', 'src/pages/index.jsx',
          'src/pages/index.astro',
          'index.html', 'index.tsx', 'index.jsx',
          'src/index.html',
        ];

    for (const pattern of exactPatterns) {
      if (sourceFiles.includes(pattern)) {
        return pattern;
      }
    }

    // Priority 2: Fuzzy match — find files containing the slug name
    if (slug !== 'index') {
      const slugMatches = sourceFiles.filter((f) => {
        const basename = f.split('/').pop() || '';
        return basename.startsWith(slug) || f.includes(`/${slug}/`) || f.includes(`/${slug}.`);
      });
      if (slugMatches.length > 0) {
        return slugMatches[0];
      }
    }

    // Priority 3: For homepage, find any main entry/layout file
    if (!urlPath || urlPath === '') {
      const layoutFiles = sourceFiles.filter((f) =>
        /\/(page|index|layout|app|home)\.(tsx|jsx|html|astro)$/.test(f),
      );
      if (layoutFiles.length > 0) {
        return layoutFiles[0];
      }
    }

    return null;
  }
}
