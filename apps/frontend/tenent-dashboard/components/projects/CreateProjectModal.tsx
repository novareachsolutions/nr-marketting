import { useState, FormEvent } from 'react';
import { Modal, modalStyles } from '../ui/Modal';
import { InputField } from '../ui/InputField';
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
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create new project"
      footer={
        <>
          <button className={modalStyles.cancelBtn} onClick={handleClose}>
            Cancel
          </button>
          <button
            className={modalStyles.submitBtn}
            onClick={handleSubmit}
            disabled={createProject.isPending}
          >
            {createProject.isPending ? 'Creating...' : 'Create project'}
          </button>
        </>
      }
    >
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        {error && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent-danger-light)',
              color: 'var(--accent-danger)',
              fontSize: 13,
              border: '1px solid var(--accent-danger)',
            }}
          >
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
        <p
          style={{
            fontSize: 12,
            color: 'var(--text-tertiary)',
            lineHeight: 1.5,
          }}
        >
          The domain will be normalized automatically (removes http://, www.,
          trailing slashes).
        </p>
      </form>
    </Modal>
  );
}
