# DataApp - PEBL Ocean Data Platform

A comprehensive Next.js application for ocean data visualization, mapping, and machine learning-powered fish detection.

## Overview

DataApp is PEBL's (Protecting Ecology Beyond Land) primary platform for ocean data management and analysis. It combines interactive mapping, data visualization, and integrated machine learning capabilities for underwater video analysis.

### Key Features

- **Interactive Mapping**: Draw and manage pins, lines, and areas on ocean maps
- **Data Visualization**: Explore and analyze ocean data with advanced filtering
- **Data Processing (Ocean-ML)**: Upload videos, annotate fish detections, and train ML models
- **Authentication**: Secure Supabase-based authentication system
- **Collaborative**: Multi-user support with real-time sync
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **UI Library**: React 19
- **Styling**: Tailwind CSS + shadcn/ui components
- **Authentication**: Supabase Auth
- **Database**: PostgreSQL (via Supabase)
- **Storage**: Supabase Storage
- **State Management**: React Query (@tanstack/react-query)
- **Maps**: Leaflet
- **Charts**: Recharts

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Supabase account
- Git

### Installation

```bash
# Clone repository
git clone <repository-url>
cd DataApp

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your Supabase credentials
```

### Environment Variables

Create `.env.local` with:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Ocean-ML Integration
OCEAN_ML_BACKEND_URL=http://localhost:8001
NEXT_PUBLIC_OCEAN_ML_BACKEND_URL=http://localhost:8001
NEXT_PUBLIC_OCEANML_PROTOCOL=oceanml

# Optional: OpenAI (for AI features)
OPENAI_API_KEY=your_openai_key
```

### Development

```bash
# Start development server
npm run dev

# Open browser
http://localhost:9002
```

### Build for Production

```bash
# Build
npm run build

# Start production server
npm start
```

## Project Structure

```
DataApp/
├── src/
│   ├── app/                        # Next.js App Router pages
│   │   ├── auth/                   # Authentication pages
│   │   ├── data-processing/        # Ocean-ML integration
│   │   ├── map-drawing/            # Interactive mapping
│   │   ├── data-explorer/          # Data visualization
│   │   └── api/                    # API routes
│   │       └── ocean-ml/           # Ocean-ML API proxy
│   ├── components/                 # React components
│   │   ├── auth/                   # Auth components
│   │   ├── layout/                 # Layout components
│   │   ├── map/                    # Map components
│   │   ├── ocean-ml/               # Ocean-ML components
│   │   └── ui/                     # shadcn/ui components
│   ├── lib/                        # Utility libraries
│   │   ├── supabase/               # Supabase clients
│   │   └── utils.ts                # Helper functions
│   └── hooks/                      # React hooks
├── public/                         # Static assets
├── docs/                           # Documentation
│   └── ocean-ml/                   # Ocean-ML docs
│       ├── README.md               # Full guide
│       ├── QUICKSTART.md           # Quick start
│       ├── SETUP.md                # Setup guide
│       └── API.md                  # API reference
├── .env.local                      # Environment variables
├── package.json                    # Dependencies
├── tailwind.config.ts              # Tailwind config
├── tsconfig.json                   # TypeScript config
└── README.md                       # This file
```

## Features

### 1. Interactive Mapping

Create and manage geographic data on interactive maps:

- **Pins**: Mark specific locations with custom metadata
- **Lines**: Draw routes and boundaries
- **Areas**: Define regions of interest
- **Projects**: Organize data into projects
- **Tags**: Categorize and filter items
- **Export**: Download data as GeoJSON

**Access**: Click "Map Drawing" in user menu

### 2. Data Explorer

Visualize and analyze ocean data:

- Advanced filtering and search
- Custom charts and graphs
- Data export capabilities
- Real-time updates

**Access**: Navigate to `/data-explorer`

### 3. Data Processing (Ocean-ML Integration)

Machine learning-powered fish detection and annotation:

#### Features:
- **Video Library**: Upload and manage underwater videos
- **Collaborative Annotation**: Lock-based annotation system
- **Model Training**: Train custom YOLOv8/v11 models
- **Inference**: Run trained models on new videos
- **Real-time Progress**: WebSocket updates for training

**Access**: Click "Data Processing" in user menu

#### Quick Start:
1. Start Ocean-ML backend (see Ocean-ML docs)
2. Navigate to Data Processing
3. Upload videos
4. Annotate fish detections
5. Train models
6. Run inference

**Documentation**: See [docs/ocean-ml/](./docs/ocean-ml/)

## Ocean-ML Integration

DataApp includes a full integration with the Ocean-ML platform for fish detection and annotation.

### Architecture

```
DataApp (Next.js) → API Proxy → Ocean-ML Backend (Python/FastAPI)
                         ↓
                  Adds Supabase Auth
```

### Setup

1. **Configure DataApp** (see above)
2. **Setup Ocean-ML Backend**: Follow [docs/ocean-ml/SETUP.md](./docs/ocean-ml/SETUP.md)
3. **Start both services**:
   - DataApp: `npm run dev`
   - Ocean-ML: `python main.py`

### Documentation

Comprehensive documentation available in `docs/ocean-ml/`:

- **[QUICKSTART.md](./docs/ocean-ml/QUICKSTART.md)** - Get started in 5 minutes
- **[SETUP.md](./docs/ocean-ml/SETUP.md)** - Complete setup guide
- **[README.md](./docs/ocean-ml/README.md)** - Full documentation
- **[API.md](./docs/ocean-ml/API.md)** - API reference

### Components

Ocean-ML components are located in `src/components/ocean-ml/`:

- `OceanMLDashboard.tsx` - Main dashboard
- `VideoLibrary.tsx` - Video management
- `VideoCard.tsx` - Video cards
- `TrainingDashboard.tsx` - Training runs

## Authentication

DataApp uses Supabase for authentication:

- **Email/Password**: Standard authentication
- **OAuth**: Support for Google, GitHub (configurable)
- **Row Level Security**: Database-level access control
- **Session Management**: Automatic token refresh

### User Roles

- **User**: Standard access to all features
- **Admin**: Additional analytics dashboard access

## Development

### Available Scripts

```bash
# Development
npm run dev          # Start dev server
npm run build        # Build for production
npm start            # Start production server

# Code Quality
npm run lint         # Run ESLint
npm run typecheck    # TypeScript type checking

# Testing
npm run test         # Run tests (if configured)
```

### Adding New Features

1. Create components in `src/components/`
2. Add pages in `src/app/`
3. Use shadcn/ui components for consistency
4. Follow existing patterns for authentication
5. Update documentation

### Styling Guidelines

- Use Tailwind CSS utility classes
- Import shadcn/ui components from `@/components/ui/`
- Follow PEBL brand colors (defined in `tailwind.config.ts`)
- Maintain responsive design (mobile-first)

## Deployment

### Vercel (Recommended)

1. Connect repository to Vercel
2. Configure environment variables
3. Deploy

```bash
vercel --prod
```

### Docker

```bash
# Build
docker build -t dataapp .

# Run
docker run -p 9002:9002 --env-file .env.local dataapp
```

### Environment Variables for Production

Update `.env.production` with production URLs:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-prod-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_prod_anon_key
OCEAN_ML_BACKEND_URL=https://api.oceanml.your-domain.com
```

## Contributing

### Development Workflow

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes
3. Test locally
4. Commit: `git commit -m "feat: add your feature"`
5. Push: `git push origin feature/your-feature`
6. Create pull request

### Code Style

- Follow TypeScript best practices
- Use meaningful variable names
- Comment complex logic
- Write self-documenting code
- Follow existing patterns

### Commit Convention

Follow conventional commits:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `style:` - Formatting
- `refactor:` - Code restructuring
- `test:` - Adding tests
- `chore:` - Maintenance

## Troubleshooting

### Common Issues

**Issue: Build fails**
```bash
# Clear cache
rm -rf .next
npm run build
```

**Issue: Authentication not working**
- Verify Supabase credentials in `.env.local`
- Check Supabase dashboard for errors
- Ensure RLS policies are configured

**Issue: Ocean-ML integration not working**
- Verify Ocean-ML backend is running
- Check `OCEAN_ML_BACKEND_URL` configuration
- Review browser console for errors
- See [Ocean-ML Troubleshooting](./docs/ocean-ml/README.md#troubleshooting)

### Getting Help

1. Check documentation in `docs/`
2. Review error messages carefully
3. Check browser console (F12)
4. Review Supabase logs
5. Contact development team

## Documentation

- **Main Documentation**: This file
- **Ocean-ML Integration**: [docs/ocean-ml/](./docs/ocean-ml/)
- **API Reference**: [docs/ocean-ml/API.md](./docs/ocean-ml/API.md)
- **Setup Guide**: [docs/ocean-ml/SETUP.md](./docs/ocean-ml/SETUP.md)
- **Quick Start**: [docs/ocean-ml/QUICKSTART.md](./docs/ocean-ml/QUICKSTART.md)

## License

Proprietary - PEBL (Protecting Ecology Beyond Land)

## Support

For support, contact the PEBL development team.

## Credits

- **PEBL Team**: Development and maintenance
- **Ocean-ML**: Fish detection platform integration
- **Supabase**: Backend infrastructure
- **Vercel**: Hosting and deployment
- **Next.js**: React framework

---

**Version**: 1.0.0
**Last Updated**: January 20, 2025
**Maintained by**: PEBL Development Team
