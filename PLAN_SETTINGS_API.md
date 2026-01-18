# Plan for New Settings API

## Overview
This document outlines a new, modernized REST API for managing Oblecto configuration, library sources, and system maintenance tasks. The goal is to consolidate scattered endpoints, improve naming conventions, and provide a more predictable interface.

## Base URL
`/api/v1`

## 1. Configuration (`/settings`)
Direct access to the core configuration object.

### Get Full Configuration
- **Endpoint:** `GET /settings`
- **Description:** Retrieves the entire system configuration.
- **Response:** JSON object containing all configuration sections (scrubbed of sensitive secrets if necessary).

### Update Full/Partial Configuration
- **Endpoint:** `PATCH /settings`
- **Description:** Update multiple configuration sections at once.
- **Body:**
  ```json
  {
    "server": { "port": 8081 },
    "transcoding": { "hardwareAcceleration": true }
  }
  ```

### Get Configuration Section
- **Endpoint:** `GET /settings/:section`
- **Params:** `section` (e.g., `server`, `transcoding`, `authentication`, `database`).
- **Description:** Retrieve a specific configuration section.

### Update Configuration Section
- **Endpoint:** `PATCH /settings/:section`
- **Params:** `section`
- **Body:** JSON object with fields to update in that section.
- **Description:** Updates specific fields within a section.

## 2. Library Management (`/libraries`)
Manage media sources and library-specific settings (movies, tvshows).

### List Libraries
- **Endpoint:** `GET /libraries`
- **Description:** Returns configuration for all libraries, including their paths.

### Get Library Details
- **Endpoint:** `GET /libraries/:type`
- **Params:** `type` (`movies` | `tvshows`)
- **Description:** Returns configuration and paths for a specific library.

### Update Library Config
- **Endpoint:** `PATCH /libraries/:type`
- **Params:** `type`
- **Body:**
  ```json
  {
    "identifiers": ["..."],
    "doReIndex": true
  }
  ```

### Add Media Path
- **Endpoint:** `POST /libraries/:type/paths`
- **Params:** `type`
- **Body:**
  ```json
  {
    "path": "/mnt/media/movies"
  }
  ```
- **Description:** Adds a new source directory to the specified library.

### Remove Media Path
- **Endpoint:** `DELETE /libraries/:type/paths`
- **Params:** `type`
- **Body:**
  ```json
  {
    "path": "/mnt/media/movies"
  }
  ```
- **Description:** Removes a source directory.

## 3. System Maintenance (`/system/maintenance`)
Consolidated endpoint for triggering background tasks.

### Trigger Maintenance Task
- **Endpoint:** `POST /system/maintenance`
- **Body:**
  ```json
  {
    "action": "scan" | "clean" | "refresh_metadata",
    "target": "all" | "movies" | "tvshows" | "files",
    "options": {} 
  }
  ```
- **Description:** Triggers a specific maintenance task.
  - **Actions:**
    - `scan`: Re-index filesystem (formerly `/settings/maintenance/index/...`).
    - `clean`: Remove invalid entries (formerly `/settings/maintenance/clean/...`).
    - `refresh_metadata`: Redownload metadata/artwork (formerly `/settings/maintenance/update/...` and `.../download/art`).
    - `import`: Trigger seedbox import (formerly `/remote-import/...`).

## 4. Remote Imports (`/system/imports`)
Dedicated endpoints for seedbox/remote import operations if they need more granularity than the maintenance endpoint.

### Trigger Import
- **Endpoint:** `POST /system/imports`
- **Body:**
  ```json
  {
    "source": "all" | "seedbox_name",
    "type": "movies" | "tvshows"
  }
  ```

## 5. System Info (`/system/info`)
### Get System Status
- **Endpoint:** `GET /system/info`
- **Response:**
  ```json
  {
    "version": "1.0.0",
    "uptime": 12345,
    "platform": "linux",
    "health": "ok"
  }
  ```

## Migration Notes
- The existing `/settings/:setting` endpoint is generic but can be mapped to `/settings/:section`.
- The existing `/sources/:type` endpoints map directly to `/libraries/:type/paths`.
- The various `/settings/maintenance/*` and `/remote-import/*` endpoints are consolidated into `POST /system/maintenance` for a cleaner command interface.
