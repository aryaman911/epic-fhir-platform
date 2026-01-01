# 🤖 AI Model Fine-Tuning Guide

This guide explains how to fine-tune AI models for healthcare-specific use cases in CareFlow Analytics.

## Overview

Fine-tuning allows you to customize AI models with your organization's specific:
- Care plan matching criteria
- Clinical terminology preferences
- Outreach messaging style
- Risk stratification algorithms

## Prerequisites

- OpenAI API account with fine-tuning access
- Training data (anonymized patient interactions)
- Python 3.8+
- At least 50 example conversations for training

---

## Part 1: Preparing Training Data

### 1.1 Data Format

OpenAI requires JSONL format with conversations:

```jsonl
{"messages": [{"role": "system", "content": "You are a healthcare analytics AI."}, {"role": "user", "content": "Analyze this diabetic patient..."}, {"role": "assistant", "content": "Based on the patient's HbA1c of 8.2%..."}]}
```

### 1.2 Sample Training Data Categories

#### Care Plan Matching
```jsonl
{"messages": [
  {"role": "system", "content": "You are a clinical care plan matching expert. Analyze patient data and recommend appropriate care plans based on ICD-10 codes, demographics, and clinical indicators."},
  {"role": "user", "content": "Patient: 65yo female with E11.9 (Type 2 diabetes), I10 (hypertension), and E78.5 (hyperlipidemia). Recent A1c: 7.8%, BP: 145/92. BMI: 31."},
  {"role": "assistant", "content": "I recommend the following care plans for this patient:\n\n1. **Diabetes Management Program** (95% match)\n   - HbA1c above target (7.8% vs goal <7%)\n   - Multiple cardiovascular risk factors present\n   - Interventions: CGM monitoring, quarterly A1c, nutrition counseling\n\n2. **Hypertension Control Program** (90% match)\n   - BP significantly elevated (145/92)\n   - Comorbid diabetes increases cardiovascular risk\n   - Interventions: Home BP monitoring, medication optimization\n\n3. **Weight Management Program** (75% match)\n   - BMI 31 (Class I obesity)\n   - Would benefit diabetes and BP control\n   - Interventions: Nutritional counseling, activity prescription"}
]}
```

#### Risk Stratification
```jsonl
{"messages": [
  {"role": "system", "content": "You are a population health risk stratification expert. Analyze patient data and assign risk levels (high, medium, low) with specific rationale."},
  {"role": "user", "content": "Evaluate risk for: 78yo male, CHF (I50.22), COPD (J44.9), CKD stage 4 (N18.4), recent hospitalization 2 weeks ago for dyspnea."},
  {"role": "assistant", "content": "**Risk Level: HIGH**\n\n**Risk Score: 92/100**\n\n**Key Factors:**\n1. Age >75 with multiple comorbidities\n2. Recent hospitalization (<30 days) - major readmission risk\n3. Triple chronic condition burden (CHF + COPD + CKD)\n4. CKD Stage 4 limits medication options\n5. COPD/CHF interaction complicates symptom management\n\n**Immediate Interventions Needed:**\n- Daily weight monitoring\n- Oxygen saturation tracking\n- Medication reconciliation within 48 hours\n- PCP follow-up within 7 days\n- Consider palliative care consult\n\n**30-Day Readmission Risk: 45%**"}
]}
```

#### Outreach Content Generation
```jsonl
{"messages": [
  {"role": "system", "content": "You are a healthcare communications specialist. Generate personalized, empathetic patient outreach letters that are warm, clear, and HIPAA-compliant."},
  {"role": "user", "content": "Write a mail letter inviting Maria Rodriguez to the Diabetes Management Program. She was recently diagnosed with Type 2 diabetes. Include program benefits and call to action."},
  {"role": "assistant", "content": "Dear Maria,\n\nWe hope this letter finds you well. As your healthcare partner, we want to share some exciting news about a program that could help you on your health journey.\n\nYou're invited to join our **Diabetes Management Program** – a personalized care program designed to help you thrive.\n\n**What's Included:**\n• A dedicated care coordinator who knows your story\n• Regular check-ins at times that work for you\n• Easy-to-understand guidance on nutrition and wellness\n• Advanced monitoring tools to track your progress\n• 24/7 support when you need it\n\n**Why Join?**\nPatients in our program have seen real improvements in their health and quality of life. We're here to support you every step of the way – you're not alone in this.\n\n**Getting Started is Easy:**\nSimply call us at 1-800-XXX-XXXX or reply to this letter. We'll answer any questions and schedule a time to chat.\n\nWe're looking forward to partnering with you.\n\nWarm regards,\n\nThe CareFlow Team\nYour Healthcare Partner"}
]}
```

### 1.3 Data Collection Script

Create `scripts/prepare_finetune_data.py`:

```python
import json
import os
from datetime import datetime

def create_training_example(system_prompt, user_input, assistant_response):
    return {
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_input},
            {"role": "assistant", "content": assistant_response}
        ]
    }

def load_historical_interactions(data_dir):
    """Load historical AI interactions from your database/files"""
    examples = []
    
    # Load from JSON files
    for filename in os.listdir(data_dir):
        if filename.endswith('.json'):
            with open(os.path.join(data_dir, filename)) as f:
                data = json.load(f)
                examples.extend(data)
    
    return examples

def filter_quality_examples(examples, min_rating=4):
    """Filter for high-quality examples based on user ratings"""
    return [ex for ex in examples if ex.get('rating', 5) >= min_rating]

def anonymize_phi(text):
    """Remove PHI from training data - CRITICAL for HIPAA compliance"""
    import re
    
    # Remove names (basic pattern - enhance for production)
    text = re.sub(r'\b[A-Z][a-z]+ [A-Z][a-z]+\b', '[PATIENT_NAME]', text)
    
    # Remove dates
    text = re.sub(r'\d{1,2}/\d{1,2}/\d{4}', '[DATE]', text)
    
    # Remove phone numbers
    text = re.sub(r'\d{3}[-.\s]?\d{3}[-.\s]?\d{4}', '[PHONE]', text)
    
    # Remove email addresses
    text = re.sub(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', '[EMAIL]', text)
    
    # Remove MRNs (Medical Record Numbers)
    text = re.sub(r'MRN[:\s]*\d+', 'MRN: [REDACTED]', text)
    
    return text

def prepare_dataset(input_dir, output_file, validation_split=0.2):
    """Prepare training and validation datasets"""
    
    # Load examples
    examples = load_historical_interactions(input_dir)
    
    # Filter quality
    examples = filter_quality_examples(examples)
    
    # Anonymize
    for ex in examples:
        for msg in ex.get('messages', []):
            msg['content'] = anonymize_phi(msg['content'])
    
    # Split train/validation
    split_idx = int(len(examples) * (1 - validation_split))
    train_examples = examples[:split_idx]
    val_examples = examples[split_idx:]
    
    # Save training data
    with open(output_file, 'w') as f:
        for ex in train_examples:
            f.write(json.dumps(ex) + '\n')
    
    # Save validation data
    val_file = output_file.replace('.jsonl', '_validation.jsonl')
    with open(val_file, 'w') as f:
        for ex in val_examples:
            f.write(json.dumps(ex) + '\n')
    
    print(f"Training examples: {len(train_examples)}")
    print(f"Validation examples: {len(val_examples)}")
    print(f"Saved to: {output_file}")

if __name__ == "__main__":
    prepare_dataset(
        input_dir="data/historical_interactions",
        output_file="data/training_data.jsonl"
    )
```

---

## Part 2: Fine-Tuning with OpenAI

### 2.1 Install OpenAI CLI
```bash
pip install openai
```

### 2.2 Set API Key
```bash
export OPENAI_API_KEY="sk-your-key"
```

### 2.3 Validate Training Data
```bash
openai tools fine_tunes.prepare_data -f data/training_data.jsonl
```

### 2.4 Create Fine-Tuning Job
```bash
openai api fine_tuning.jobs.create \
  -t data/training_data.jsonl \
  -v data/training_data_validation.jsonl \
  -m gpt-3.5-turbo \
  --suffix "careflow-v1"
```

### 2.5 Monitor Training
```bash
# List jobs
openai api fine_tuning.jobs.list

# Get specific job status
openai api fine_tuning.jobs.retrieve -i ftjob-abc123

# Stream events
openai api fine_tuning.jobs.follow -i ftjob-abc123
```

### 2.6 Use Fine-Tuned Model
Once complete, update your `.env`:
```env
OPENAI_FINE_TUNED_MODEL=ft:gpt-3.5-turbo:careflow:careflow-v1:abc123
```

---

## Part 3: Self-Hosted Open Source Models

For maximum privacy and control, deploy open-source models.

### 3.1 Recommended Models

| Model | Size | Use Case |
|-------|------|----------|
| Llama 3.1 8B | 8B | General healthcare Q&A |
| Mistral 7B | 7B | Fast inference |
| Mixtral 8x7B | 47B | Complex analysis |
| BioMistral | 7B | Clinical NLP |

### 3.2 Deploy with vLLM

```bash
# Install vLLM
pip install vllm

# Download model
huggingface-cli download meta-llama/Meta-Llama-3.1-8B-Instruct

# Start server
python -m vllm.entrypoints.openai.api_server \
  --model meta-llama/Meta-Llama-3.1-8B-Instruct \
  --port 8000
```

### 3.3 Docker Deployment
```dockerfile
FROM vllm/vllm-openai:latest

ENV MODEL_NAME="meta-llama/Meta-Llama-3.1-8B-Instruct"
ENV MAX_MODEL_LEN=4096

EXPOSE 8000

CMD ["python", "-m", "vllm.entrypoints.openai.api_server", \
     "--model", "${MODEL_NAME}", \
     "--max-model-len", "${MAX_MODEL_LEN}"]
```

### 3.4 Cloud Deployment Options

#### AWS SageMaker
```python
import sagemaker
from sagemaker.huggingface import HuggingFaceModel

model = HuggingFaceModel(
    model_data="s3://your-bucket/model.tar.gz",
    role=sagemaker.get_execution_role(),
    transformers_version="4.37",
    pytorch_version="2.1",
    py_version="py310"
)

predictor = model.deploy(
    instance_type="ml.g5.2xlarge",
    initial_instance_count=1
)
```

#### Google Cloud Run
```yaml
# cloudbuild.yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/careflow-llm', '.']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/careflow-llm']
  - name: 'gcr.io/cloud-builders/gcloud'
    args:
      - 'run'
      - 'deploy'
      - 'careflow-llm'
      - '--image=gcr.io/$PROJECT_ID/careflow-llm'
      - '--platform=managed'
      - '--region=us-central1'
      - '--memory=16Gi'
      - '--cpu=4'
```

---

## Part 4: Fine-Tuning Open Source Models

### 4.1 Using LoRA for Efficient Fine-Tuning

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from datasets import load_dataset
import torch

# Load base model
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Meta-Llama-3.1-8B-Instruct",
    torch_dtype=torch.bfloat16,
    device_map="auto"
)

# Configure LoRA
lora_config = LoraConfig(
    r=16,
    lora_alpha=32,
    target_modules=["q_proj", "v_proj", "k_proj", "o_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM"
)

# Apply LoRA
model = prepare_model_for_kbit_training(model)
model = get_peft_model(model, lora_config)

# Load training data
dataset = load_dataset("json", data_files="data/training_data.jsonl")

# Train (simplified - use full Trainer in production)
from transformers import TrainingArguments, Trainer

training_args = TrainingArguments(
    output_dir="./careflow-lora",
    per_device_train_batch_size=4,
    gradient_accumulation_steps=4,
    num_train_epochs=3,
    learning_rate=2e-4,
    fp16=True,
    logging_steps=10,
    save_strategy="epoch"
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=dataset["train"]
)

trainer.train()
model.save_pretrained("./careflow-lora-final")
```

### 4.2 Merge LoRA Weights

```python
from peft import PeftModel

# Load base model
base_model = AutoModelForCausalLM.from_pretrained("meta-llama/Meta-Llama-3.1-8B-Instruct")

# Load LoRA
model = PeftModel.from_pretrained(base_model, "./careflow-lora-final")

# Merge weights
merged_model = model.merge_and_unload()

# Save merged model
merged_model.save_pretrained("./careflow-merged")
```

---

## Part 5: Integration with CareFlow

### 5.1 Update AI Service for Custom Models

```javascript
// backend/src/services/aiService.js

class AIService {
  constructor() {
    // ... existing code ...
    
    // Add self-hosted model endpoint
    this.selfHostedEndpoint = process.env.SELF_HOSTED_LLM_URL;
  }

  async getSelfHostedResponse(prompt, systemPrompt) {
    if (!this.selfHostedEndpoint) {
      throw new Error('Self-hosted model not configured');
    }

    const response = await axios.post(`${this.selfHostedEndpoint}/v1/chat/completions`, {
      model: 'careflow-fine-tuned',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    return {
      content: response.data.choices[0].message.content,
      model: 'careflow-self-hosted',
      usage: response.data.usage
    };
  }

  // Add to getDualAnalysis for 3-way comparison
  async getTripleAnalysis(prompt, systemPrompt, options = {}) {
    const [openai, claude, selfHosted] = await Promise.allSettled([
      this.getOpenAIResponse(prompt, systemPrompt, options),
      this.getClaudeResponse(prompt, systemPrompt, options),
      this.getSelfHostedResponse(prompt, systemPrompt)
    ]);

    return {
      openai: openai.status === 'fulfilled' ? openai.value : null,
      claude: claude.status === 'fulfilled' ? claude.value : null,
      selfHosted: selfHosted.status === 'fulfilled' ? selfHosted.value : null
    };
  }
}
```

### 5.2 Environment Variables

Add to `.env`:
```env
SELF_HOSTED_LLM_URL=http://your-llm-server:8000
SELF_HOSTED_MODEL_NAME=careflow-fine-tuned
USE_SELF_HOSTED_FOR_PHI=true
```

---

## Best Practices

### Data Quality
- Minimum 50 examples per task type
- Include diverse cases (edge cases, common cases)
- Have clinical experts review training data
- Update training data quarterly

### Privacy & Compliance
- **ALWAYS** anonymize PHI before fine-tuning
- Use synthetic data when possible
- Keep training data audit logs
- Follow HIPAA guidelines for AI training

### Model Evaluation
- Create a held-out test set
- Measure task-specific metrics
- Compare against baseline models
- Track performance over time

### Monitoring
- Log all model predictions
- Track error rates by category
- Set up alerts for quality degradation
- Retrain when performance drops

---

## Resources

- [OpenAI Fine-Tuning Guide](https://platform.openai.com/docs/guides/fine-tuning)
- [Hugging Face PEFT](https://huggingface.co/docs/peft)
- [vLLM Documentation](https://docs.vllm.ai/)
- [Clinical NLP Best Practices](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7295511/)
