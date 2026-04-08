import { useState, FormEvent } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '../ui/Dialog';
import { InputField } from '../ui/Input';
import { Button } from '../ui/Button';
import { useCreateProject } from '@/hooks/useProjects';
import { showSuccessToast } from '@repo/shared-frontend';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateProjectModal({ isOpen, onClose, onCreated }: Props) {
  const [domain, setDomain] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const createProject = useCreateProject();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!domain.trim() || !name.trim()) {
      setError('Domain and name are required');
      return;
    }

    try {
      await createProject.mutateAsync({
        url: '/projects',
        body: { domain: domain.trim(), name: name.trim() },
      });
      showSuccessToast('Project created', `${name} has been added`);
      setDomain('');
      setName('');
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create project');
    }
  };

  const handleClose = () => {
    setDomain('');
    setName('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create new project</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="px-3.5 py-2.5 rounded-md bg-accent-danger-light text-accent-danger text-[13px] border border-accent-danger">
                {error}
              </div>
            )}
            <InputField
              label="Website domain"
              type="text"
              placeholder="example.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              autoFocus
            />
            <InputField
              label="Project name"
              type="text"
              placeholder="My Website"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <p className="text-xs text-text-tertiary leading-relaxed">
              The domain will be normalized automatically (removes http://, www., trailing slashes).
            </p>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createProject.isPending}>
            {createProject.isPending ? 'Creating...' : 'Create project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
