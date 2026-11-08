
import { useEffect, useRef, useState } from "react";

function DrawingCanvas({
  disabled = false,
  onStroke,
  onClear,
  remoteStrokes = [],
  clearSignal = 0
}) {
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const currentStroke = useRef(null);
  const strokes = useRef([]);
  const remoteIndex = useRef(0);

  const [color, setColor] = useState("#222222");
  const [brushSize, setBrushSize] = useState(5);
  const [tool, setTool] = useState("brush");
  const [strokeCount, setStrokeCount] = useState(0);

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    strokes.current.forEach((stroke) => {
      const points = stroke.points;
      if (!points || points.length === 0) return;

      const scale = canvas.width / rect.width;

      ctx.beginPath();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle =
        stroke.tool === "eraser" ? "#ffffff" : stroke.color;
      ctx.fillStyle =
        stroke.tool === "eraser" ? "#ffffff" : stroke.color;
      ctx.lineWidth = stroke.width * scale;

      const first = points[0];
      ctx.moveTo(first.x * canvas.width, first.y * canvas.height);

      points.slice(1).forEach((point) => {
        ctx.lineTo(point.x * canvas.width, point.y * canvas.height);
      });

      if (points.length === 1) {
        ctx.lineTo(
          first.x * canvas.width + 0.1,
          first.y * canvas.height + 0.1
        );
      }

      ctx.stroke();

      if (points.length === 1) {
        ctx.beginPath();
        ctx.arc(
          first.x * canvas.width,
          first.y * canvas.height,
          (stroke.width * scale) / 2,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    });

    setStrokeCount(strokes.current.length);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);

      redrawCanvas();
    };

    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(canvas);
    resizeCanvas();

    return () => observer.disconnect();
  }, []);

  // Add newly received remote drawing segments.
  useEffect(() => {
    if (remoteStrokes.length < remoteIndex.current) {
      remoteIndex.current = 0;
    }

    for (let i = remoteIndex.current; i < remoteStrokes.length; i++) {
      strokes.current.push(remoteStrokes[i]);
    }

    remoteIndex.current = remoteStrokes.length;

    if (remoteStrokes.length > 0) {
      redrawCanvas();
    }
  }, [remoteStrokes]);

  // Clear this canvas when another player clears the room canvas.
  useEffect(() => {
    strokes.current = [];
    remoteIndex.current = 0;
    setStrokeCount(0);
    redrawCanvas();
  }, [clearSignal]);

  const getPosition = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
    };
  };

  const startDrawing = (event) => {
    if (disabled || event.button !== 0) return;

    event.preventDefault();

    const canvas = canvasRef.current;
    canvas.setPointerCapture(event.pointerId);

    isDrawing.current = true;

    const point = getPosition(event);

    currentStroke.current = {
      color,
      width: brushSize,
      tool,
      points: [point]
    };

    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;

    ctx.beginPath();
    ctx.fillStyle = tool === "eraser" ? "#ffffff" : color;
    ctx.arc(
      point.x * canvas.width,
      point.y * canvas.height,
      (brushSize * scale) / 2,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Send the starting point immediately.
    if (onStroke) {
      onStroke({
        color,
        width: brushSize,
        tool,
        points: [point]
      });
    }
  };

  const draw = (event) => {
    if (!isDrawing.current || !currentStroke.current) return;

    event.preventDefault();

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();

    const newPoint = getPosition(event);
    const points = currentStroke.current.points;
    const previousPoint = points[points.length - 1];

    points.push(newPoint);

    ctx.beginPath();
    ctx.moveTo(
      previousPoint.x * canvas.width,
      previousPoint.y * canvas.height
    );
    ctx.lineTo(
      newPoint.x * canvas.width,
      newPoint.y * canvas.height
    );

    ctx.strokeStyle =
      currentStroke.current.tool === "eraser"
        ? "#ffffff"
        : currentStroke.current.color;

    ctx.lineWidth =
      currentStroke.current.width * (canvas.width / rect.width);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();

    // Send only the latest segment, not the entire drawing.
    if (onStroke) {
      onStroke({
        color: currentStroke.current.color,
        width: currentStroke.current.width,
        tool: currentStroke.current.tool,
        points: [previousPoint, newPoint]
      });
    }
  };

  const stopDrawing = (event) => {
    if (!isDrawing.current) return;

    isDrawing.current = false;

    const canvas = canvasRef.current;

    if (event && canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }

    if (currentStroke.current) {
      strokes.current.push(currentStroke.current);
      setStrokeCount(strokes.current.length);
    }

    currentStroke.current = null;
  };

  const undo = () => {
    if (disabled || strokes.current.length === 0) return;

    strokes.current.pop();
    redrawCanvas();
  };

  const clearCanvas = () => {
    if (disabled) return;

    strokes.current = [];
    remoteIndex.current = remoteStrokes.length;
    setStrokeCount(0);
    redrawCanvas();

    if (onClear) onClear();
  };

  const downloadDrawing = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = "scribblelan-drawing.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <div className="drawing-tool">
      <div className="drawing-toolbar">
        <div className="drawing-control">
          <label htmlFor="brush-color">Colour</label>
          <input
            id="brush-color"
            type="color"
            value={color}
            disabled={disabled || tool === "eraser"}
            onChange={(e) => setColor(e.target.value)}
          />
        </div>

        <div className="drawing-control">
          <label htmlFor="brush-size">Size: {brushSize}px</label>
          <input
            id="brush-size"
            type="range"
            min="2"
            max="25"
            value={brushSize}
            disabled={disabled}
            onChange={(e) => setBrushSize(Number(e.target.value))}
          />
        </div>

        <button
          type="button"
          className={tool === "brush" ? "tool-button active" : "tool-button"}
          disabled={disabled}
          onClick={() => setTool("brush")}
        >
          Brush
        </button>

        <button
          type="button"
          className={tool === "eraser" ? "tool-button active" : "tool-button"}
          disabled={disabled}
          onClick={() => setTool("eraser")}
        >
          Eraser
        </button>

        <button
          type="button"
          className="tool-button"
          disabled={disabled || strokeCount === 0}
          onClick={undo}
        >
          Undo
        </button>

        <button
          type="button"
          className="tool-button"
          disabled={disabled}
          onClick={clearCanvas}
        >
          Clear
        </button>

        <button
          type="button"
          className="tool-button"
          onClick={downloadDrawing}
        >
          Download
        </button>
      </div>

      <div className="drawing-canvas-wrapper">
        <canvas
          ref={canvasRef}
          className="drawing-canvas"
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerCancel={stopDrawing}
          onLostPointerCapture={stopDrawing}
        />
      </div>

      <div className="drawing-footer">
        <span>{strokeCount} strokes</span>
        {disabled && <span>Drawing is currently disabled</span>}
      </div>
    </div>
  );
}

export default DrawingCanvas;
