# CloudDrive — Cloud Storage Web App

A full-stack cloud storage app built with **React + Tailwind CSS** (frontend) and **Flask** (backend).

## Running the App (Recommended)

The easiest way to run this app is with Docker. No Python or Node.js required.

### Prerequisites

- Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)

### Steps

1. Download the `docker-compose.yml` file from this repo
2. Open a terminal in the folder where you saved it
3. Run:

```bash
docker compose up
```

4. Open your browser and go to **http://localhost**

Docker will automatically pull the images on first run. Subsequent runs will start instantly.

To stop the app, press `Ctrl+C` in the terminal, then run:

```bash
docker compose down
```

---

## Features

- Register / Login with JWT authentication
- Upload files (up to 500 MB)
- View all your files in a clean grid
- Download any file
- Delete files
- Files are stored per-user on the server

---

## Project Structure

```
cloud-storage-app/
├── backend/
│   ├── app.py          # Flask app entry point
│   ├── auth.py         # Register/login routes
│   ├── files.py        # File CRUD routes
│   ├── models.py       # User + File database models
│   ├── config.py       # Configuration
│   └── requirements.txt
└── frontend/
    └── src/
        ├── pages/       # Login, Register, Dashboard
        ├── components/  # Navbar, FileCard
        ├── context/     # Auth state management
        └── api/         # Axios client
```

---

## Running Without Docker (Manual Setup)

### Prerequisites

1. **Python 3.10+** → https://www.python.org/downloads/
   - During install, check **"Add Python to PATH"**
2. **Node.js 18+** → https://nodejs.org/en/download
   - Includes npm automatically

### Backend (Flask)

```bash
cd backend
python -m venv venv

# Windows:
venv\Scripts\activate

pip install -r requirements.txt
python app.py
```

The API will run at **http://localhost:5000**

### Frontend (React)

```bash
cd frontend
npm install
npm run dev
```

The app will open at **http://localhost:5173**
