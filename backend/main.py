from io import BytesIO
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from ultralytics import YOLO


# ============================================================
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[1]
MODEL_PATH = BASE_DIR / "best.pt"


if not MODEL_PATH.exists():
    raise RuntimeError(
        f"YOLO model not found at {MODEL_PATH}"
    )


# ============================================================
# LOAD MODEL
# ============================================================

print(f"Loading YOLO model from: {MODEL_PATH}")

model = YOLO(str(MODEL_PATH))

print("YOLO model loaded successfully.")


# ============================================================
# FASTAPI
# ============================================================

app = FastAPI(
    title="RASTA Detection API"
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,

    allow_origins=[
        "https://muhammad-hashir-19.github.io",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
    ],

    allow_credentials=False,

    allow_methods=[
        "GET",
        "POST",
        "OPTIONS",
    ],

    allow_headers=["*"],
)


# ============================================================
# HELPERS
# ============================================================

def class_name(
    names: Any,
    class_id: int
) -> str:

    if isinstance(names, dict):
        return str(
            names.get(
                class_id,
                class_id
            )
        )

    if 0 <= class_id < len(names):
        return str(
            names[class_id]
        )

    return str(class_id)


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/health")
def health() -> dict[str, str]:

    return {
        "status": "ok",
        "model": MODEL_PATH.name
    }


# ============================================================
# DETECTION
# ============================================================

@app.post("/detect")
async def detect(
    file: UploadFile = File(...)
) -> dict[str, list[dict[str, float | str]]]:

    # --------------------------------------------------------
    # Validate file type
    # --------------------------------------------------------

    if (
        not file.content_type
        or not file.content_type.startswith("image/")
    ):
        raise HTTPException(
            status_code=415,
            detail="An image file is required"
        )

    try:

        # ----------------------------------------------------
        # Read uploaded image
        # ----------------------------------------------------

        image_bytes = await file.read()

        if not image_bytes:
            raise HTTPException(
                status_code=400,
                detail="Empty image received"
            )

        image = Image.open(
            BytesIO(image_bytes)
        ).convert("RGB")


        # ----------------------------------------------------
        # Resize image BEFORE YOLO
        #
        # This is important for Render Free.
        #
        # Browser sends 1280x720.
        # We reduce it before inference.
        # ----------------------------------------------------

        max_width = 640
        max_height = 640

        image.thumbnail(
            (max_width, max_height),
            Image.Resampling.LANCZOS
        )


        # ----------------------------------------------------
        # YOLO INFERENCE
        #
        # imgsz=320 dramatically reduces CPU work.
        # device="cpu" explicitly uses CPU.
        # conf=0.25 keeps reasonable detections.
        # ----------------------------------------------------

        results = model.predict(
            source=image,
            imgsz=320,
            conf=0.25,
            device="cpu",
            verbose=False
        )


    except HTTPException:
        raise

    except Exception as exc:

        print(
            f"Detection error: {type(exc).__name__}: {exc}"
        )

        raise HTTPException(
            status_code=400,
            detail=f"Unable to process image: {exc}"
        ) from exc


    # ========================================================
    # BUILD RESPONSE
    # ========================================================

    detections: list[
        dict[str, float | str]
    ] = []


    for result in results:

        names = result.names
        boxes = result.boxes

        if boxes is None:
            continue


        for (
            box,
            confidence,
            class_id
        ) in zip(
            boxes.xyxy.tolist(),
            boxes.conf.tolist(),
            boxes.cls.tolist()
        ):

            x1, y1, x2, y2 = box


            detections.append({

                "x1": float(x1),

                "y1": float(y1),

                "x2": float(x2),

                "y2": float(y2),

                "confidence":
                    float(confidence),

                "class_name":
                    class_name(
                        names,
                        int(class_id)
                    )
            })


    print(
        f"Detection completed: "
        f"{len(detections)} detections"
    )


    return {
        "detections": detections
    }
