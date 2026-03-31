# @repo/shared-common

Universal utilities and types shared across all packages.

## Usage

```typescript
import { isEmail, formatDate, APP_NAME } from '@repo/shared-common';

console.log(isEmail('test@example.com')); // true
console.log(formatDate(new Date())); // "January 1, 2024"
console.log(APP_NAME); // "My App"
```
