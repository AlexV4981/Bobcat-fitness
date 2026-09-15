# Bobcat Fitness

Bobcat Fitness is a web-based fitness tracking application built with:

* React + Vite for the frontend
* Python + FastAPI for the backend
* SQLite for local database storage

---

# 1. Clone the Repository in VS Code

Before cloning, make sure your GitHub SSH key is already connected to your GitHub account.

Open **Visual Studio Code**.

Open the Command Palette:

```text
Ctrl + Shift + P
```

Search for:

```text
Git: Clone
```

Select:

```text
Git: Clone
```

Paste the SSH repository URL:

```text
git@github.com:AlexV4981/Bobcat-fitness.git
```

Choose where you want the project saved on your computer.

When VS Code finishes cloning, select:

```text
Open
```

to open the repository.

The project should look similar to:

```text
Bobcat-fitness/
│
├── frontend/
│   ├── public/
│   ├── src/
│   ├── package.json
│   ├── package-lock.json
│   └── vite.config.js
│
├── backend/
│   ├── app/
│   └── requirements.txt
│
├── .gitignore
└── README.md
```

---

# 2. Open the VS Code Terminal

In VS Code, open:

```text
Terminal → New Terminal
```

or use:

```text
Ctrl + `
```

The terminal should open inside:

```text
Bobcat-fitness/
```

Verify with:

```bash
git status
```

You should see that you are on the repository's current branch.

---

# 3. Install Frontend Dependencies

In the VS Code terminal:

```bash
cd frontend
```

Install all frontend dependencies:

```bash
npm ci
```

This installs the packages already defined in:

```text
package.json
package-lock.json
```

If `npm ci` does not work, use:

```bash
npm install
```

You should now have:

```text
frontend/node_modules/
```

Do not commit `node_modules`.

---

# 4. Start the Frontend

While still inside:

```text
Bobcat-fitness/frontend/
```

run:

```bash
npm run dev
```

Vite should display a local address similar to:

```text
http://localhost:5173
```

Open that address in your browser.

Keep this terminal running.

---

# 5. Open a Second VS Code Terminal

In VS Code, click the **+** button in the terminal panel to create another terminal.

The first terminal should continue running the frontend.

In the new terminal, make sure you are at the project root:

```text
Bobcat-fitness/
```

Then run:

```bash
cd backend
```

---

# 6. Create the Python Virtual Environment

From:

```text
Bobcat-fitness/backend/
```

run:

```bash
python -m venv .venv
```

This creates a local Python environment for the backend.

The `.venv` folder should not be committed to GitHub.

---

# 7. Activate the Python Environment

## Windows PowerShell

```powershell
.venv\Scripts\Activate.ps1
```

If PowerShell blocks the script, run:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

Then retry:

```powershell
.venv\Scripts\Activate.ps1
```

---

## Windows Command Prompt

```cmd
.venv\Scripts\activate.bat
```

---

## macOS / Linux

```bash
source .venv/bin/activate
```

Once activated, the terminal should begin with:

```text
(.venv)
```

---

# 8. Install Backend Dependencies

With the virtual environment activated:

```bash
pip install -r requirements.txt
```

This installs the Python packages required by the backend.

The project currently uses packages including:

```text
FastAPI
Uvicorn
SQLModel
PyJWT
pwdlib
python-multipart
```

---

# 9. Start the Backend

Still inside:

```text
Bobcat-fitness/backend/
```

with `.venv` activated:

```bash
uvicorn app.main:app --reload
```

The backend should start at:

```text
http://127.0.0.1:8000
```

Keep this terminal running.

---

# 10. Test the Backend

Open:

```text
http://127.0.0.1:8000/api/health
```

You should receive:

```json
{
  "status": "ok"
}
```

FastAPI documentation can also be opened at:

```text
http://127.0.0.1:8000/docs
```

---

# 11. Development Environment

During normal development, keep two VS Code terminals open.

## Terminal 1 — Frontend

```bash
cd frontend
npm run dev
```

Frontend:

```text
http://localhost:5173
```

## Terminal 2 — Backend

```bash
cd backend
```

Activate the virtual environment.

Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

Then run:

```bash
uvicorn app.main:app --reload
```

Backend:

```text
http://127.0.0.1:8000
```

The development setup should look like:

```text
VS Code
│
├── Terminal 1
│   └── React / Vite
│       └── localhost:5173
│
└── Terminal 2
    └── FastAPI
        └── localhost:8000
            │
            └── SQLite
```

---

# 12. Starting the Project After the First Setup

You only need to install the dependencies and create `.venv` once.

After that, when returning to the project:

## Frontend

Open a VS Code terminal:

```bash
cd frontend
npm run dev
```

## Backend

Open another VS Code terminal:

```bash
cd backend
```

Activate `.venv`.

Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

Then:

```bash
uvicorn app.main:app --reload
```

---

# 13. Pull the Latest Code Before Working

Before starting a ticket, return to the project root:

```bash
cd ..
```

If needed, check your location:

```bash
git status
```

Switch to `main`:

```bash
git checkout main
```

Download the newest team changes:

```bash
git pull
```

---

# 14. Create a Branch for Your Ticket

Do not work directly on `main`.

Create a branch for the assigned ticket.

Example:

```bash
git checkout -b feature/FIT-101-ui-shell
```

Other examples:

```bash
git checkout -b feature/FIT-102-login-profile
```

```bash
git checkout -b feature/FIT-103-workout-schedule
```

Check your current branch:

```bash
git branch
```

The active branch will have:

```text
*
```

next to it.

---

# 15. Push Your Work to GitHub

After completing work:

```bash
git status
```

Stage the files:

```bash
git add .
```

Commit:

```bash
git commit -m "Complete FIT-### feature description"
```

Example:

```bash
git commit -m "Complete FIT-103 workout schedule"
```

Push the branch:

```bash
git push -u origin YOUR-BRANCH-NAME
```

Example:

```bash
git push -u origin feature/FIT-103-workout-schedule
```

Then open GitHub and create a Pull Request into:

```text
main
```

---

# 16. If Dependencies Change

If another teammate adds a frontend package and changes:

```text
frontend/package.json
frontend/package-lock.json
```

after pulling the newest changes run:

```bash
cd frontend
npm install
```

If the backend's:

```text
backend/requirements.txt
```

changes, activate `.venv` and run:

```bash
pip install -r requirements.txt
```

---

# Quick First-Time Setup

After cloning the project through VS Code:

## Terminal 1

```bash
cd frontend
npm ci
npm run dev
```

## Terminal 2

```bash
cd backend
python -m venv .venv
```

Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Run the backend:

```bash
uvicorn app.main:app --reload
```

Test:

```text
Frontend:
http://localhost:5173

Backend:
http://127.0.0.1:8000

Backend Health:
http://127.0.0.1:8000/api/health

FastAPI Docs:
http://127.0.0.1:8000/docs
```

If the frontend loads and `/api/health` returns:

```json
{
  "status": "ok"
}
```

the development environment is ready.
