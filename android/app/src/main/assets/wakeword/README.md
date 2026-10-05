# Wake word models (openWakeWord)

| File | Role | License |
|------|------|---------|
| `melspectrogram.onnx`, `embedding_model.onnx` | shared audio feature extractor | Apache 2.0 |
| `hey_jarvis_v0.1.onnx` | "Hey Jarvis" classifier | **CC BY-NC-SA 4.0 (non-commercial)** |

Source: https://github.com/dscripka/openWakeWord/releases/tag/v0.5.1

The pre-trained classifiers are non-commercial because of their training data.
If GIA is ever monetised, replace `hey_jarvis_v0.1.onnx` with a classifier you
trained yourself (see docs/wake-word.md) - no code changes are needed: any
`<name>.onnx` dropped in this folder is picked up automatically.
