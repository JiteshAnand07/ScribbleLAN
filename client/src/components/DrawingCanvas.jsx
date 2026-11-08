
import { useEffect, useRef, useState } from "react";

function DrawingCanvas() {

  const canvasRef = useRef(null);
  const isDrawing = useRef(false);

  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(5);
  const [eraser, setEraser] = useState(false);

  const colors = [
    "#000000",
    "#ef4444",
    "#2563eb",
    "#16a34a",
    "#eab308",
    "#a855f7",
    "#ec4899",
    "#f97316"
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    context.lineCap = "round";
    context.lineJoin = "round";

    context.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const getPosition = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height)
    };
  };

  const startDrawing = (event) => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    isDrawing.current = true;

    canvas.setPointerCapture(event.pointerId);

    const pos = getPosition(event);

    context.beginPath();
    context.moveTo(pos.x, pos.y);
  };

  const draw = (event) => {
    if (!isDrawing.current) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    const pos = getPosition(event);

    context.strokeStyle = eraser ? "#ffffff" : color;
    context.lineWidth = brushSize;

    context.lineTo(pos.x, pos.y);
    context.stroke();
  };

  const stopDrawing = () => {
    isDrawing.current = false;

    const canvas = canvasRef.current;
    canvas.getContext("2d").closePath();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    context.clearRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div className="drawing-area">

      <div className="drawing-toolbar">

        <div className="color-palette">
          {colors.map((item) => (
            <button
              key={item}
              className={`color-option ${
                color === item && !eraser ? "selected" : ""
              }`}
              style={{ background: item }}
              onClick={() => {
                setColor(item);
                setEraser(false);
              }}
              title={item}
            />
          ))}
        </div>

        <div className="brush-controls">

          <label>Brush Size</label>

          <input
            type="range"
            min="2"
            max="20"
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
          />

          <span>{brushSize}px</span>

        </div>

        <button
          className={`tool-btn ${eraser ? "active-tool" : ""}`}
          onClick={() => setEraser(true)}
        >
          Eraser
        </button>

        <button className="tool-btn" onClick={clearCanvas}>
          Clear
        </button>

      </div>

      <canvas
        ref={canvasRef}
        width={800}
        height={450}
        className="drawing-canvas"
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerCancel={stopDrawing}
        onPointerLeave={stopDrawing}
      />

    </div>
  );
}

export default DrawingCanvas;
