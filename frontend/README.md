# Supplement Dashboard - Frontend

A React-based visual dashboard for viewing and managing customer supplement profiles with Material-UI components.

## Features

- **Customer Dashboard**: Grid view of all customers with search, filter, and sort capabilities
- **Customer Detail Pages**: Complete customer profiles with activity timeline and folder structure
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Real-time Search**: Filter customers by name or address
- **Status Management**: Visual indicators for customer status (needs supplement, in progress, completed, pending)
- **Activity Timeline**: Chronological view of all customer activities
- **Folder Browser**: Visual representation of customer document folders

## Tech Stack

- **React 18** with TypeScript
- **Material-UI (MUI)** for UI components
- **React Router** for navigation
- **Axios** for API calls
- **date-fns** for date formatting

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Backend API running on `http://localhost:5000` (or configure via .env)

## Installation

1. Navigate to the frontend directory:
```bash
cd supplement_dashboard/frontend
```

2. Install dependencies (already done if you're reading this):
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
```

Edit `.env` and set your API URL (default is already configured):
```
REACT_APP_API_URL=http://localhost:5000/api
```

## Running the Application

### Development Mode

Start the development server:
```bash
npm start
```

The application will open at `http://localhost:3000`

### Production Build

Create an optimized production build:
```bash
npm run build
```

The build files will be in the `build/` directory.

### Running Tests

Run the test suite:
```bash
npm test
```

## Project Structure

```
frontend/
├── public/              # Static files
├── src/
│   ├── components/      # React components
│   │   ├── Common/      # Reusable components (LoadingSpinner, ErrorBoundary, StatusChip)
│   │   ├── Dashboard/   # Dashboard components (CustomerCard, CustomerGrid, FilterBar)
│   │   ├── CustomerDetail/  # Customer detail components
│   │   └── Layout/      # Layout components (AppLayout, Sidebar, TopBar, Breadcrumbs)
│   ├── services/        # API service layer
│   │   ├── api.ts       # Axios configuration
│   │   └── customerService.ts  # Customer API calls
│   ├── types/           # TypeScript type definitions
│   │   └── customer.ts  # Customer, Activity, FolderInfo types
│   ├── utils/           # Utility functions
│   │   ├── constants.ts # App constants
│   │   └── formatters.ts # Date and data formatters
│   ├── App.tsx          # Main app component with routing
│   └── index.tsx        # Entry point
├── .env                 # Environment variables
├── .env.example         # Environment variables template
├── package.json         # Dependencies
├── tsconfig.json        # TypeScript configuration
└── README.md            # This file
```

## Available Routes

- `/` - Dashboard (customer grid view)
- `/customers` - Customers list (same as dashboard)
- `/customers/:id` - Customer detail page
- `/files` - Files view (placeholder)

## Components Overview

### Dashboard Components

- **Dashboard**: Main dashboard with search, filter, and sort
- **CustomerCard**: Card displaying customer summary
- **CustomerGrid**: Grid layout for customer cards
- **FilterBar**: Status filter and sort controls

### Customer Detail Components

- **CustomerDetail**: Main customer detail page
- **ProfilePanel**: Customer profile information
- **TimelinePanel**: Activity timeline
- **FolderBrowser**: Document folder structure

### Layout Components

- **AppLayout**: Main layout wrapper with sidebar and topbar
- **Sidebar**: Navigation sidebar
- **TopBar**: Top app bar with search
- **Breadcrumbs**: Navigation breadcrumbs

### Common Components

- **LoadingSpinner**: Loading indicator
- **ErrorBoundary**: Error handling wrapper
- **StatusChip**: Status indicator chip

## API Integration

The frontend expects the following API endpoints:

```
GET    /api/customers                    # List all customers
GET    /api/customers/:id                # Get customer detail
GET    /api/customers/:id/activities     # Get customer activities
GET    /api/customers/:id/folders        # Get folder structure
GET    /api/customers?search=:query      # Search customers
GET    /api/customers?status=:status     # Filter by status
GET    /api/customers?sort=:field&order=:order  # Sort customers
```

## Configuration

### Environment Variables

- `REACT_APP_API_URL`: Backend API base URL (default: `http://localhost:5000/api`)

### Theme Customization

Edit the theme in `src/App.tsx`:

```typescript
const theme = createTheme({
  palette: {
    primary: { main: '#1976d2' },
    secondary: { main: '#dc004e' },
    // ... more colors
  },
});
```

## Features in Detail

### Search

- Real-time search as you type
- Searches customer name, property address, and city
- Case-insensitive

### Filter

- Filter by status: All, Needs Supplement, In Progress, Completed, Pending
- Combines with search

### Sort

- Sort by: Name (A-Z, Z-A), Date (Newest/Oldest), Supplement Count
- Maintains current filter and search

### Customer Detail

- Full customer profile with contact information
- Insurance and claim details
- Activity timeline with icons and dates
- Folder structure with file counts
- Back navigation to dashboard

## Development

### Adding New Components

1. Create component in appropriate directory under `src/components/`
2. Export from the component file
3. Import and use in parent component

### Adding New API Calls

1. Add method to `src/services/customerService.ts`
2. Use the `api` instance from `src/services/api.ts`
3. Handle errors appropriately

### Type Definitions

Add new types to `src/types/customer.ts` or create new type files as needed.

## Troubleshooting

### API Connection Issues

- Verify backend is running on the correct port
- Check `.env` file has correct `REACT_APP_API_URL`
- Check browser console for CORS errors
- Ensure backend allows requests from `http://localhost:3000`

### Build Errors

- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Clear cache: `npm cache clean --force`
- Check Node.js version: `node --version` (should be v16+)

### TypeScript Errors

- Run type check: `npx tsc --noEmit`
- Check `tsconfig.json` is properly configured

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

---

## Create React App Documentation

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

### Available Scripts

In the project directory, you can run:

#### `npm start`

Runs the app in the development mode.
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.
You will also see any lint errors in the console.

#### `npm test`

Launches the test runner in the interactive watch mode.
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

#### `npm run build`

Builds the app for production to the `build` folder.
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).
