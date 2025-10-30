# Architecture Diagrams
## PEBL DataApp System Architecture

**Note:** These are Mermaid diagrams that render in GitHub and modern markdown viewers.

---

## Table of Contents
1. [High-Level System Architecture](#1-high-level-system-architecture)
2. [Authentication Flow](#2-authentication-flow)
3. [Data Ingestion Pipeline](#3-data-ingestion-pipeline)
4. [File Upload & Storage Flow](#4-file-upload--storage-flow)
5. [Map Rendering Pipeline](#5-map-rendering-pipeline)
6. [Project Sharing Flow](#6-project-sharing-flow)
7. [Database Schema ERD](#7-database-schema-erd)
8. [Service Layer Architecture](#8-service-layer-architecture)
9. [Component Hierarchy](#9-component-hierarchy)
10. [Data Flow: Pin Creation](#10-data-flow-pin-creation)

---

## 1. High-Level System Architecture

```mermaid
graph TB
    subgraph "Client Browser"
        UI[Next.js Pages<br/>React Components]
        STATE[Client State<br/>useState/hooks]
        LOCALSTORAGE[localStorage<br/>Offline Backup]
    end

    subgraph "Supabase Cloud"
        AUTH[Supabase Auth<br/>GoTrue]
        DB[(PostgreSQL<br/>with RLS)]
        STORAGE[Supabase Storage<br/>S3-like]
        REALTIME[Realtime<br/>WebSocket]
    end

    subgraph "External Services"
        TILES[CartoDB<br/>Map Tiles]
        SENTRY[Sentry<br/>Error Tracking]
        VERCEL[Vercel<br/>Hosting]
    end

    UI --> STATE
    STATE --> LOCALSTORAGE
    UI --> AUTH
    UI --> DB
    UI --> STORAGE
    UI --> TILES
    UI --> SENTRY

    DB --> REALTIME
    REALTIME -.-> UI

    AUTH -.->|JWT| DB

    VERCEL -->|Hosts| UI

    style UI fill:#e1f5ff
    style DB fill:#ffe1e1
    style STORAGE fill:#fff3e1
    style AUTH fill:#e1ffe1
```

---

## 2. Authentication Flow

```mermaid
sequenceDiagram
    actor User
    participant Browser
    participant Next.js
    participant Supabase Auth
    participant PostgreSQL
    participant Middleware

    User->>Browser: Navigate to /auth
    Browser->>Next.js: GET /auth
    Next.js->>Supabase Auth: Check session

    alt No Session
        Next.js-->>Browser: Show login form
        User->>Browser: Enter email/password
        Browser->>Supabase Auth: signInWithPassword()
        Supabase Auth->>Supabase Auth: Validate credentials
        Supabase Auth-->>Browser: JWT tokens (httpOnly cookies)
    end

    Browser->>Next.js: Navigate to /map-drawing
    Next.js->>Middleware: Request intercept
    Middleware->>Supabase Auth: auth.getUser() with cookies
    Supabase Auth-->>Middleware: User object
    Middleware->>Middleware: Refresh tokens if needed
    Middleware->>Middleware: Update cookies
    Middleware-->>Next.js: Allow request

    Next.js->>PostgreSQL: Query with RLS
    Note over PostgreSQL: auth.uid() = user_id
    PostgreSQL-->>Next.js: User's data only
    Next.js-->>Browser: Render page
```

---

## 3. Data Ingestion Pipeline

```mermaid
graph LR
    subgraph "Upload"
        FILE[CSV File]
        UPLOAD[File Upload Dialog]
    end

    subgraph "Validation"
        VAL1[File Type Check]
        VAL2[Size Check]
        VAL3[Auth Check]
        VAL4[Ownership Check]
    end

    subgraph "Storage"
        STORE[Supabase Storage<br/>pins/pinId/uuid.csv]
        META[(pin_files table<br/>metadata)]
    end

    subgraph "Processing"
        PARSE[CSV Parser<br/>csvParser.ts]
        DATE[Date Format<br/>Detection]
        VALIDATE[Data Validation<br/>Quality Checks]
    end

    subgraph "Visualization"
        CHART[Chart Display<br/>Recharts]
        TIMELINE[Data Timeline]
        STATS[Statistical<br/>Analysis]
    end

    FILE --> UPLOAD
    UPLOAD --> VAL1
    VAL1 --> VAL2
    VAL2 --> VAL3
    VAL3 --> VAL4
    VAL4 --> STORE
    STORE --> META
    META --> PARSE
    PARSE --> DATE
    DATE --> VALIDATE
    VALIDATE --> CHART
    VALIDATE --> TIMELINE
    VALIDATE --> STATS

    style FILE fill:#e1f5ff
    style STORE fill:#ffe1e1
    style PARSE fill:#fff3e1
    style CHART fill:#e1ffe1
```

---

## 4. File Upload & Storage Flow

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant FileStorageService
    participant Supabase Auth
    participant PostgreSQL
    participant Supabase Storage

    User->>UI: Drop CSV file on pin
    UI->>FileStorageService: uploadFile(pinId, file)

    FileStorageService->>FileStorageService: validateFile(file)
    Note over FileStorageService: Check type, size,<br/>extension

    FileStorageService->>Supabase Auth: auth.getUser()
    Supabase Auth-->>FileStorageService: User object

    FileStorageService->>PostgreSQL: SELECT pins WHERE id=pinId<br/>AND user_id=auth.uid()

    alt Pin exists and owned
        PostgreSQL-->>FileStorageService: Pin data
        FileStorageService->>FileStorageService: Generate UUID filename
        FileStorageService->>Supabase Storage: upload(pins/pinId/uuid.csv, file)
        Supabase Storage-->>FileStorageService: Upload success
        FileStorageService->>PostgreSQL: INSERT INTO pin_files<br/>(metadata)
        PostgreSQL-->>FileStorageService: Metadata record
        FileStorageService-->>UI: Success + metadata
        UI->>User: Show success toast
    else Pin not found or not owned
        PostgreSQL-->>FileStorageService: Empty result
        FileStorageService-->>UI: Error: Unauthorized
        UI->>User: Show error toast
    end
```

---

## 5. Map Rendering Pipeline

```mermaid
graph TB
    subgraph "State Management"
        HOOK[useMapData Hook]
        STATE[pins, lines, areas<br/>useState]
        LOCAL[localStorage<br/>backup]
    end

    subgraph "Data Fetching"
        SERVICE[MapDataService]
        SUPABASE[(Supabase)]
        RLS[RLS Policies]
    end

    subgraph "Leaflet Map"
        MAP[LeafletMap.tsx]
        MARKERS[Pin Markers]
        POLYLINES[Line Polylines]
        POLYGONS[Area Polygons]
        POPUPS[Popups & Labels]
    end

    subgraph "User Interactions"
        DRAW[Drawing Tools]
        EDIT[Edit Mode]
        CLICK[Click Handlers]
    end

    HOOK --> SERVICE
    SERVICE --> SUPABASE
    SUPABASE --> RLS
    RLS --> STATE
    STATE --> LOCAL
    STATE --> MAP

    MAP --> MARKERS
    MAP --> POLYLINES
    MAP --> POLYGONS
    MAP --> POPUPS

    DRAW --> MAP
    EDIT --> MAP
    CLICK --> MAP

    MAP -.->|Callbacks| HOOK

    style STATE fill:#e1f5ff
    style MAP fill:#fff3e1
    style SUPABASE fill:#ffe1e1
```

---

## 6. Project Sharing Flow

```mermaid
sequenceDiagram
    actor Owner
    actor Collaborator
    participant UI
    participant UserValidation
    participant PostgreSQL
    participant Email Service
    participant Supabase Auth

    Owner->>UI: Click "Share Project"
    UI->>UI: Show share dialog
    Owner->>UI: Enter collaborator email
    Owner->>UI: Select permission (view/edit/admin)

    UI->>UserValidation: validateUserEmail(email)
    UserValidation->>PostgreSQL: SELECT FROM auth.users<br/>WHERE email=?

    alt User Exists
        PostgreSQL-->>UserValidation: User found
        UserValidation->>PostgreSQL: INSERT INTO project_shares<br/>(project_id, user_id, permission)
        PostgreSQL-->>UserValidation: Share created
        UserValidation->>PostgreSQL: INSERT INTO notifications<br/>(user_id, type='share')
        UserValidation-->>UI: Success
        UI->>Owner: Show "Shared with {email}"

        Collaborator->>UI: Login to app
        UI->>PostgreSQL: Query projects<br/>(WHERE user_id OR has_project_access)
        PostgreSQL-->>UI: Shared project included
        UI->>Collaborator: Show shared project
    else User Not Found
        PostgreSQL-->>UserValidation: No user
        UserValidation->>PostgreSQL: INSERT INTO project_invitations<br/>(project_id, invitee_email, token)
        PostgreSQL-->>UserValidation: Invitation created
        UserValidation->>Email Service: sendInvitationEmail(email, token)
        Email Service-->>Collaborator: Email with invite link
        UserValidation-->>UI: Invitation sent
        UI->>Owner: Show "Invitation sent to {email}"

        Collaborator->>Email Service: Click invite link
        Email Service->>UI: Open /invite/{token}
        UI->>Supabase Auth: Prompt signup/login
        Collaborator->>Supabase Auth: Complete signup/login
        Supabase Auth-->>UI: User authenticated
        UI->>PostgreSQL: accept_invitation(token, user_email)
        PostgreSQL->>PostgreSQL: Create project_share<br/>Update invitation status
        PostgreSQL-->>UI: Invitation accepted
        UI->>Collaborator: Redirect to shared project
    end
```

---

## 7. Database Schema ERD

```mermaid
erDiagram
    USERS ||--o{ PROJECTS : creates
    USERS ||--o{ PINS : owns
    USERS ||--o{ LINES : owns
    USERS ||--o{ AREAS : owns

    PROJECTS ||--o{ PINS : contains
    PROJECTS ||--o{ LINES : contains
    PROJECTS ||--o{ AREAS : contains
    PROJECTS ||--o{ TAGS : has
    PROJECTS ||--o{ PROJECT_SHARES : "shared via"

    PINS ||--o{ PIN_FILES : "has files"
    AREAS ||--o{ PIN_FILES : "has files"

    PINS ||--o{ PIN_TAGS : tagged
    TAGS ||--o{ PIN_TAGS : tags

    LINES ||--o{ LINE_TAGS : tagged
    TAGS ||--o{ LINE_TAGS : tags

    AREAS ||--o{ AREA_TAGS : tagged
    TAGS ||--o{ AREA_TAGS : tags

    PIN_FILES ||--o{ MERGED_FILES : "source for"

    PROJECTS ||--o{ PROJECT_INVITATIONS : "invites to"

    USERS ||--o{ SAVED_PLOT_VIEWS : creates
    PINS ||--o{ SAVED_PLOT_VIEWS : "associated with"

    USERS {
        uuid id PK
        string email
        string display_name
    }

    PROJECTS {
        uuid id PK
        uuid user_id FK
        string name
        text description
        timestamp created_at
    }

    PINS {
        uuid id PK
        uuid user_id FK
        uuid project_id FK
        float lat
        float lng
        string label
        text notes
        boolean object_visible
        string color
        int size
    }

    LINES {
        uuid id PK
        uuid user_id FK
        uuid project_id FK
        jsonb path
        string label
        text notes
        string color
        int size
    }

    AREAS {
        uuid id PK
        uuid user_id FK
        uuid project_id FK
        jsonb path
        string label
        text notes
        string color
        int transparency
    }

    TAGS {
        uuid id PK
        uuid user_id FK
        uuid project_id FK
        string name
        string color
    }

    PIN_FILES {
        uuid id PK
        uuid pin_id FK
        uuid area_id FK
        string file_name
        string file_path
        bigint file_size
        date start_date
        date end_date
        boolean is_discrete
        jsonb visual_properties
    }

    PROJECT_SHARES {
        uuid id PK
        uuid project_id FK
        uuid user_id FK
        string permission_level
        uuid shared_by FK
    }
```

---

## 8. Service Layer Architecture

```mermaid
graph TB
    subgraph "React Components"
        PAGE[map-drawing/page.tsx]
        PIN_CHART[PinChartDisplay.tsx]
        TIMELINE[DataTimeline.tsx]
    end

    subgraph "Custom Hooks"
        USE_MAP[useMapData]
        USE_PROJECT[useActiveProject]
        USE_SHARED[useSharedPins]
    end

    subgraph "Service Layer"
        MAP_SVC[MapDataService]
        FILE_SVC[FileStorageService]
        PLOT_SVC[PlotViewService]
        MERGE_SVC[MergedFilesService]
        PROJECT_SVC[ProjectService]
        SHARE_SVC[SharingService]
        VALIDATE_SVC[UserValidationService]
    end

    subgraph "Supabase Client"
        AUTH[Auth Client]
        DB[Database Client]
        STORAGE[Storage Client]
    end

    subgraph "Database"
        TABLES[(Tables with RLS)]
        FUNCTIONS[PL/pgSQL Functions]
        TRIGGERS[Triggers]
    end

    PAGE --> USE_MAP
    PAGE --> USE_PROJECT
    PIN_CHART --> USE_MAP
    TIMELINE --> FILE_SVC

    USE_MAP --> MAP_SVC
    USE_MAP --> FILE_SVC
    USE_PROJECT --> PROJECT_SVC
    USE_SHARED --> SHARE_SVC

    MAP_SVC --> DB
    FILE_SVC --> STORAGE
    FILE_SVC --> DB
    PLOT_SVC --> DB
    MERGE_SVC --> DB
    PROJECT_SVC --> DB
    SHARE_SVC --> DB
    VALIDATE_SVC --> AUTH
    VALIDATE_SVC --> DB

    DB --> TABLES
    DB --> FUNCTIONS
    TABLES --> TRIGGERS

    style PAGE fill:#e1f5ff
    style MAP_SVC fill:#fff3e1
    style DB fill:#ffe1e1
```

---

## 9. Component Hierarchy

```mermaid
graph TB
    ROOT[app/layout.tsx<br/>Root Layout]

    subgraph "Authentication"
        AUTH_PAGE[auth/page.tsx]
        AUTH_FORM[AuthForm.tsx]
        USER_MENU[UserMenu.tsx]
    end

    subgraph "Main Application"
        MAP_PAGE[map-drawing/page.tsx<br/>8,385 lines]

        subgraph "Map Components"
            LEAFLET[LeafletMap.tsx]
            SIMPLE_MAP[SimpleLeafletMap.tsx]
            DATA_MAP[DataExplorerMap.tsx]
        end

        subgraph "Data Display"
            PIN_CHART[PinChartDisplay.tsx]
            TIMELINE[DataTimeline.tsx]
            MARINE_GRID[MarinePlotsGrid.tsx]
            HEATMAP[HaplotypeHeatmap.tsx]
        end

        subgraph "Dialogs & Modals"
            FILE_UPLOAD[FileUploadDialog]
            PIN_EDIT[PinEditDialog]
            PROJECT_SETTINGS[ProjectSettingsDialog]
            SHARING[SharingDialog]
        end
    end

    subgraph "Data Explorer"
        EXPLORER_PAGE[data-explorer/page.tsx]
        FILE_ACTIONS[FileActionsDialog]
        OUTLIER[OutlierCleanupDialog]
    end

    ROOT --> AUTH_PAGE
    ROOT --> MAP_PAGE
    ROOT --> EXPLORER_PAGE

    AUTH_PAGE --> AUTH_FORM
    ROOT --> USER_MENU

    MAP_PAGE --> LEAFLET
    MAP_PAGE --> PIN_CHART
    MAP_PAGE --> TIMELINE
    MAP_PAGE --> MARINE_GRID
    MAP_PAGE --> FILE_UPLOAD
    MAP_PAGE --> PIN_EDIT
    MAP_PAGE --> PROJECT_SETTINGS
    MAP_PAGE --> SHARING

    EXPLORER_PAGE --> DATA_MAP
    EXPLORER_PAGE --> FILE_ACTIONS
    EXPLORER_PAGE --> OUTLIER

    style MAP_PAGE fill:#ffe1e1
    style LEAFLET fill:#fff3e1
    style PIN_CHART fill:#e1ffe1
```

---

## 10. Data Flow: Pin Creation with File Upload

```mermaid
sequenceDiagram
    actor User
    participant Map
    participant page.tsx
    participant useMapData
    participant MapDataService
    participant Supabase
    participant RLS
    participant FileUpload
    participant FileStorageService

    User->>Map: Click on map
    Map->>page.tsx: onPinSave callback
    page.tsx->>page.tsx: Show pin creation dialog
    User->>page.tsx: Enter label, notes, tags
    page.tsx->>useMapData: createPin(pinData)

    useMapData->>MapDataService: createPin()
    MapDataService->>Supabase: auth.getUser()
    Supabase-->>MapDataService: User object

    MapDataService->>Supabase: INSERT INTO pins<br/>(user_id, lat, lng, label...)
    Supabase->>RLS: Check policy:<br/>user_id = auth.uid()
    RLS-->>Supabase: Allow
    Supabase-->>MapDataService: Created pin with ID

    MapDataService->>MapDataService: Update localStorage
    MapDataService-->>useMapData: Pin object
    useMapData->>useMapData: setPins([...pins, newPin])
    useMapData-->>page.tsx: Success

    page.tsx->>Map: Render new pin marker
    Map-->>User: Pin visible on map

    User->>Map: Click pin
    Map->>page.tsx: Show pin details
    User->>page.tsx: Click "Upload File"
    page.tsx->>FileUpload: Show upload dialog
    User->>FileUpload: Drop CSV file

    FileUpload->>FileStorageService: uploadFile(pinId, file)
    FileStorageService->>FileStorageService: validateFile(type, size)
    FileStorageService->>Supabase: Verify ownership
    FileStorageService->>Supabase: Upload to storage
    FileStorageService->>Supabase: INSERT INTO pin_files
    FileStorageService-->>FileUpload: Success + metadata

    FileUpload-->>page.tsx: File uploaded
    page.tsx->>PIN_CHART[PinChartDisplay]: Fetch and render data
    PIN_CHART-->>User: Show chart
```

---

## 11. RLS Security Model

```mermaid
graph TB
    subgraph "Client Request"
        CLIENT[Supabase Client<br/>with JWT]
    end

    subgraph "Supabase Server"
        AUTH_CHECK{auth.uid()<br/>extracted from JWT}
    end

    subgraph "PostgreSQL"
        QUERY[Query Execution]

        subgraph "RLS Policies"
            POLICY1[Policy: user_id = auth.uid]
            POLICY2[Policy: has_project_access]
            POLICY3[Policy: is_shared_with_user]
        end

        TABLES[(Tables)]
    end

    subgraph "Response"
        FILTERED[Filtered Results<br/>User's data only]
    end

    CLIENT --> AUTH_CHECK
    AUTH_CHECK --> QUERY
    QUERY --> POLICY1
    QUERY --> POLICY2
    QUERY --> POLICY3

    POLICY1 --> TABLES
    POLICY2 --> TABLES
    POLICY3 --> TABLES

    TABLES --> FILTERED
    FILTERED --> CLIENT

    style AUTH_CHECK fill:#ffe1e1
    style POLICY1 fill:#e1ffe1
    style FILTERED fill:#e1f5ff
```

---

## 12. CSV Parsing Pipeline

```mermaid
graph LR
    subgraph "Input"
        FILE[CSV File]
    end

    subgraph "Parsing"
        PAPA[PapaParse]
        DETECT[Detect Time Column]
        FORMAT[Detect Date Format]
    end

    subgraph "Date Processing"
        ISO{ISO 8601?}
        SLASH{Slash Format?}
        DD_MM{DD/MM or MM/DD?}
        ANALYZE[Pattern Analysis]
    end

    subgraph "Validation"
        RANGE[Year Range 1970-2100]
        BOUNDS[Month 1-12, Day 1-31]
        AUTO[Auto-correction Check]
    end

    subgraph "Output"
        PARSED[Parsed Data Points]
        ERRORS[Error Log]
        DIAGNOSTICS[Diagnostic Log]
    end

    FILE --> PAPA
    PAPA --> DETECT
    DETECT --> FORMAT

    FORMAT --> ISO
    ISO -->|Yes| PARSED
    ISO -->|No| SLASH
    SLASH -->|Yes| DD_MM
    DD_MM --> ANALYZE
    ANALYZE --> RANGE
    RANGE --> BOUNDS
    BOUNDS --> AUTO
    AUTO --> PARSED

    ANALYZE -.->|Issues| ERRORS
    AUTO -.->|Details| DIAGNOSTICS

    style FILE fill:#e1f5ff
    style PARSED fill:#e1ffe1
    style ERRORS fill:#ffe1e1
```

---

## 13. Performance Optimization Points

```mermaid
graph TB
    subgraph "Frontend"
        BUNDLE[Bundle Splitting<br/>Framework/Supabase/Charts]
        LAZY[Lazy Loading<br/>Components]
        MEMO[Memoization<br/>useMemo/useCallback]
    end

    subgraph "Map"
        RAF[RequestAnimationFrame<br/>Throttling]
        VIEWPORT[Viewport Culling<br/>TODO]
        CLUSTER[Marker Clustering<br/>TODO]
    end

    subgraph "Data"
        CACHE[localStorage Cache]
        DEBOUNCE[Debounced Queries]
        BATCH[Batch Operations]
    end

    subgraph "Database"
        INDEXES[Proper Indexes<br/>user_id, project_id]
        RLS[Efficient RLS Policies]
        JOINS[Single-Query Joins]
    end

    subgraph "Network"
        CDN[CDN for Tiles<br/>CartoDB]
        COMPRESSION[Gzip/Brotli]
        HTTP2[HTTP/2]
    end

    BUNDLE -.->|Reduces| LAZY
    LAZY -.->|Improves| MEMO
    RAF -.->|Enables| VIEWPORT
    VIEWPORT -.->|With| CLUSTER
    CACHE -.->|Backs| DEBOUNCE
    DEBOUNCE -.->|Enables| BATCH
    INDEXES -.->|Speed| RLS
    RLS -.->|Optimized| JOINS

    style RAF fill:#e1ffe1
    style CACHE fill:#fff3e1
    style INDEXES fill:#ffe1e1
```

---

## 14. Deployment Architecture

```mermaid
graph TB
    subgraph "Development"
        DEV[Local Dev Server<br/>localhost:9002]
        GIT[Git Repository<br/>GitHub]
    end

    subgraph "CI/CD"
        PUSH[git push]
        VERCEL_CI[Vercel Build<br/>TypeScript + ESLint]
        PREVIEW[Preview Deployment<br/>preview-xxx.vercel.app]
    end

    subgraph "Production"
        PROD[Production Deployment<br/>yourdomain.com]
        EDGE[Vercel Edge Network<br/>Global CDN]
    end

    subgraph "Backend Services"
        SUPABASE_PROD[(Supabase Production<br/>Database + Auth + Storage)]
    end

    subgraph "Monitoring"
        SENTRY[Sentry<br/>Error Tracking]
        VERCEL_ANALYTICS[Vercel Analytics<br/>Web Vitals]
        LOGS[Axiom<br/>Structured Logs]
    end

    DEV --> GIT
    GIT --> PUSH
    PUSH --> VERCEL_CI
    VERCEL_CI --> PREVIEW
    PREVIEW -->|PR Merged| PROD
    PROD --> EDGE

    PROD --> SUPABASE_PROD
    PROD --> SENTRY
    PROD --> VERCEL_ANALYTICS
    PROD --> LOGS

    style PROD fill:#e1ffe1
    style SENTRY fill:#ffe1e1
```

---

## Notes

- **Mermaid Syntax:** These diagrams use Mermaid.js syntax and render automatically in:
  - GitHub README/markdown files
  - GitLab
  - VS Code (with Mermaid extension)
  - Many documentation tools

- **Export Options:** To export as images:
  ```bash
  npm install -g @mermaid-js/mermaid-cli
  mmdc -i ARCHITECTURE_DIAGRAMS.md -o diagrams/
  ```

- **Interactive Editing:** Use https://mermaid.live/ to edit and preview

---

**Document Status:** Complete
**Total Diagrams:** 14
**Next:** Refer to specific diagram by section number
