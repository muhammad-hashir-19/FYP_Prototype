# RASTA

Road Anomaly Sensing, Tracking & Analysis prototype.

## Local run

Start the YOLO API from the repository root:

```powershell
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

Start the frontend from the `potholes` directory:

```powershell
python -m http.server 5500 --directory potholes
```

Open <http://localhost:5500>.

## Deployment

The project has two deployable parts:

- The static frontend is in `potholes/` and can be served by GitHub Pages.
- The FastAPI YOLO service is defined in `render.yaml` and must run on a Python host such as Render. GitHub Pages cannot run Python or load `best.pt`.

After deploying the API, set the frontend API URL before publishing by changing `window.RASTA_API_URL` in the page or replacing the default API URL in `potholes/js/detector.js` with the deployed API URL.

The model file is `best.pt`. The API contract is `POST /detect` with an image multipart field named `file`, returning `{ "detections": [] }`.
