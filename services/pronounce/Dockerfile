# 發音評分服務：一個指令就能自行架設（見 README.md）
FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends espeak-ng && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir onnxruntime==1.19.2 numpy
# 日文讀音工具（選裝）：裝不起來時，日文改用 eSpeak NG（漢字可能讀錯）
RUN pip install --no-cache-dir pyopenjtalk-prebuilt || echo "pyopenjtalk not available on this platform"
COPY server/app.py /app/app.py
ENV MODEL=/model/model.int8.onnx VOCAB=/model/vocab.json PORT=8080
EXPOSE 8080
CMD ["python", "-u", "/app/app.py"]
