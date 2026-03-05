# Services Layer

Service files in this directory will contain API interaction logic using the configured Axios instance from `src/lib/api.js`.

## Planned Services:
- `ride.service.js`: Ride-related API calls.
- `driver.service.js`: Driver-specific API calls.
- `user.service.js`: User profile and authentication (via backend).

Example usage:
```javascript
import api from '../lib/api';

export const getRides = async () => {
  const response = await api.get('/rides');
  return response.data;
};
```
