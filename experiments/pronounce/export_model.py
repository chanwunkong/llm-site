"""Export the multilingual phone model to ONNX (fp32 + int8) for a small 4-core ARM board (CPU only).

Run on the Mac:  .venv/bin/python export_model.py
Output: model/model.onnx, model/model.int8.onnx, model/vocab.json
"""
import json
import os

import torch
from onnxruntime.quantization import QuantType, quantize_dynamic
from transformers import Wav2Vec2ForCTC

NAME = "facebook/wav2vec2-xlsr-53-espeak-cv-ft"
os.makedirs("model", exist_ok=True)

model = Wav2Vec2ForCTC.from_pretrained(NAME).eval()
vocab_path = __import__("huggingface_hub").hf_hub_download(NAME, "vocab.json")
json.dump(json.load(open(vocab_path)), open("model/vocab.json", "w"), ensure_ascii=False)

dummy = torch.zeros(1, 16000)
torch.onnx.export(model, (dummy,), "model/model.onnx", input_names=["audio"], output_names=["logits"],
                  dynamic_axes={"audio": {1: "samples"}, "logits": {1: "frames"}}, opset_version=17,
                  dynamo=False)
# conv layers stay fp32: ORT has no ConvInteger kernel; MatMuls hold most of the compute
quantize_dynamic("model/model.onnx", "model/model.int8.onnx", weight_type=QuantType.QInt8,
                 op_types_to_quantize=["MatMul"])
for f in ("model.onnx", "model.int8.onnx"):
    print(f, os.path.getsize(f"model/{f}") // 2**20, "MB")
