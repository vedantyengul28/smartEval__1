import os
import logging
from pathlib import Path
from typing import Tuple, Optional

from ..config import settings

logger = logging.getLogger(__name__)

_trocr_model = None
_trocr_processor = None
_trocr_loaded = False


def _load_trocr():
    global _trocr_model, _trocr_processor, _trocr_loaded
    if _trocr_loaded:
        return _trocr_processor, _trocr_model
    if settings.use_mock_mode:
        _trocr_loaded = True
        return None, None
    try:
        import torch
        from transformers import TrOCRProcessor, VisionEncoderDecoderModel
        from PIL import Image

        logger.info(f"Loading TrOCR processor: {settings.trocr_processor}")
        _trocr_processor = TrOCRProcessor.from_pretrained(
            settings.trocr_processor,
            cache_dir=settings.model_cache_dir,
        )
        logger.info(f"Loading TrOCR model: {settings.trocr_model}")
        _trocr_model = VisionEncoderDecoderModel.from_pretrained(
            settings.trocr_model,
            cache_dir=settings.model_cache_dir,
        )
        _trocr_model.eval()
        _trocr_loaded = True
        logger.info("TrOCR loaded successfully")
        return _trocr_processor, _trocr_model
    except Exception as e:
        logger.warning(f"Failed to load TrOCR: {e}. Using fallback OCR mode.")
        _trocr_loaded = True
        return None, None


def _read_pdf_pages(file_path: str) -> list:
    images = []
    try:
        import pypdfium2 as pdfium
        pdf = pdfium.PdfDocument(file_path)
        for i in range(len(pdf)):
            page = pdf[i]
            pil_image = page.render(scale=2.5).to_pil().convert("RGB")
            images.append(pil_image)
    except Exception as e:
        logger.warning(f"PDFium rendering failed: {e}")
        try:
            from pdf2image import convert_from_path
            images = convert_from_path(file_path, dpi=300)
        except Exception as e2:
            logger.warning(f"pdf2image also failed: {e2}")
    return images


def _image_to_pil(file_path: str) -> Optional["Image.Image"]:
    try:
        from PIL import Image
        return Image.open(file_path).convert("RGB")
    except Exception as e:
        logger.warning(f"Failed to open image {file_path}: {e}")
        return None


def _run_trocr_on_image(pil_image) -> str:
    processor, model = _load_trocr()
    if processor is None or model is None:
        return ""
    try:
        import torch
        pixel_values = processor(images=pil_image, return_tensors="pt").pixel_values
        with torch.no_grad():
            generated_ids = model.generate(
                pixel_values,
                max_length=256,
                num_beams=4,
                early_stopping=True,
            )
        text = processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
        return text
    except Exception as e:
        logger.warning(f"TrOCR inference failed: {e}")
        return ""


def _mock_ocr_text(file_path: str) -> str:
    filename = Path(file_path).stem.lower()
    sample_map = {
        "stack": (
            "A Stack is a linear data structure following LIFO order. "
            "Like a stack of cafeteria plates, you push items on top and pop from the top. "
            "Core operations are push, pop, and peek, each running in O(1) constant time. "
            "Stacks are used for function call management in the call stack, "
            "expression evaluation, undo-redo features, and DFS graph traversal."
        ),
        "queue": (
            "A Queue is a linear data structure that follows FIFO, first in first out. "
            "Think of a line of people waiting at a ticket counter. "
            "Enqueue adds to the rear and dequeue removes from the front. "
            "Used in scheduling tasks, breadth-first search, and message buffers."
        ),
        "linked": (
            "A linked list is a linear data structure with nodes. Each node has data and a next pointer. "
            "Singly linked lists have next pointers only. Doubly linked lists have previous and next. "
            "Insertion and deletion are O(1) if position is known, but access is O(n) sequential."
        ),
        "answer": (
            "A Stack is a linear data structure that follows the Last-In-First-Out (LIFO) principle, "
            "meaning the last element added is the first one to be removed. "
            "A real-world analogy is a stack of plates in a cafeteria: you can only add or remove plates from the top. "
            "Core operations include push which adds an element to the top in O(1), "
            "pop which removes the top element also O(1), and peek which returns the top element without removal O(1). "
            "Stacks are essential for managing function calls with the call stack, expression evaluation, "
            "undo and redo functionality in editors, and depth-first search traversal of graphs and trees."
        ),
    }
    for key, text in sample_map.items():
        if key in filename:
            return text
    return (
        "This is a sample extracted text from the uploaded document. "
        "In a full production deployment, TrOCR (Transformer-based Optical Character Recognition) "
        "would run on the uploaded image or PDF and return the actual handwritten content. "
        "This mock text is returned because AI_USE_MOCK_MODE=true or TrOCR model is not available. "
        "A Stack follows LIFO principle with push pop and peek operations. "
        "Used in call stack DFS traversal and expression evaluation."
    )


def process_file(file_path: str, file_type: str = "png") -> Tuple[str, int, bool]:
    if not file_path or not os.path.exists(file_path):
        return "", 0, True

    ext = file_type.lower().lstrip(".")
    all_text_parts = []
    page_count = 0
    fallback_used = True

    processor, model = _load_trocr()
    use_real_trocr = processor is not None and model is not None

    if ext == "pdf":
        pages = _read_pdf_pages(file_path)
        page_count = len(pages)
        if use_real_trocr:
            for page_img in pages:
                t = _run_trocr_on_image(page_img)
                if t:
                    all_text_parts.append(t)
                    fallback_used = False
    else:
        pil_img = _image_to_pil(file_path)
        page_count = 1
        if pil_img is not None and use_real_trocr:
            t = _run_trocr_on_image(pil_img)
            if t:
                all_text_parts.append(t)
                fallback_used = False

    if not all_text_parts:
        text = _mock_ocr_text(file_path)
        all_text_parts.append(text)
        fallback_used = True

    return "\n\n".join(all_text_parts), page_count or 1, fallback_used
