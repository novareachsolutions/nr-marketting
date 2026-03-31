# @repo/shared-frontend

Shared frontend components, hooks, and utilities.

## Usage

```typescript
import { Button, useLocalStorage, useGet, usePost, apiClient } from '@repo/shared-frontend';

function MyComponent() {
  const [value, setValue] = useLocalStorage('myKey', 'default');
  const { data, isLoading } = useGet('/api/users');
  const { mutate: createUser } = usePost(['users']);

  return <Button onClick={() => setValue('new value')}>Click me</Button>;
}
```
