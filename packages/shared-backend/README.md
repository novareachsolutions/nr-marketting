# @repo/shared-backend

Shared backend utilities, types, and middleware.

## Usage

```typescript
import { Logger, successResponse } from '@repo/shared-backend';

const logger = new Logger('MyService');
logger.log('Hello from shared backend');

const response = successResponse({ id: 1 }, 'User created');
```
