const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const logger = require('../utils/logger');

class AIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
    
    this.fineTunedModel = process.env.OPENAI_FINE_TUNED_MODEL || null;
  }

  // Get responses from both models and compare
  async getDualAnalysis(prompt, systemPrompt, options = {}) {
    const [openaiResponse, claudeResponse] = await Promise.allSettled([
      this.getOpenAIResponse(prompt, systemPrompt, options),
      this.getClaudeResponse(prompt, systemPrompt, options)
    ]);

    const results = {
      openai: openaiResponse.status === 'fulfilled' ? openaiResponse.value : null,
      claude: claudeResponse.status === 'fulfilled' ? claudeResponse.value : null,
      errors: {}
    };

    if (openaiResponse.status === 'rejected') {
      results.errors.openai = openaiResponse.reason.message;
    }
    if (claudeResponse.status === 'rejected') {
      results.errors.claude = claudeResponse.reason.message;
    }

    // Determine best response based on options
    if (options.selectBest && results.openai && results.claude) {
      results.selected = await this.selectBestResponse(
        results.openai,
        results.claude,
        prompt,
        options.selectionCriteria
      );
    }

    return results;
  }

  // OpenAI GPT-4 response
  async getOpenAIResponse(prompt, systemPrompt, options = {}) {
    try {
      const model = this.fineTunedModel || options.model || 'gpt-4-turbo-preview';
      
      const response = await this.openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 2000
      });

      return {
        content: response.choices[0].message.content,
        model: model,
        usage: response.usage,
        finishReason: response.choices[0].finish_reason
      };
    } catch (error) {
      logger.error('OpenAI API error:', error.message);
      throw error;
    }
  }

  // Claude response
  async getClaudeResponse(prompt, systemPrompt, options = {}) {
    try {
      const response = await this.anthropic.messages.create({
        model: options.model || 'claude-3-5-sonnet-20241022',
        max_tokens: options.maxTokens || 2000,
        system: systemPrompt,
        messages: [
          { role: 'user', content: prompt }
        ]
      });

      return {
        content: response.content[0].text,
        model: response.model,
        usage: {
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens
        },
        stopReason: response.stop_reason
      };
    } catch (error) {
      logger.error('Claude API error:', error.message);
      throw error;
    }
  }

  // Select best response between two models
  async selectBestResponse(openaiResult, claudeResult, originalPrompt, criteria) {
    const selectionPrompt = `
You are an expert evaluator. Compare these two AI responses and select the better one.

Original Prompt: ${originalPrompt}

Response A (OpenAI):
${openaiResult.content}

Response B (Claude):
${claudeResult.content}

Evaluation Criteria: ${criteria || 'accuracy, helpfulness, clarity, completeness'}

Respond with JSON only:
{
  "selected": "A" or "B",
  "reasoning": "brief explanation",
  "scores": {
    "A": { "accuracy": 1-10, "helpfulness": 1-10, "clarity": 1-10 },
    "B": { "accuracy": 1-10, "helpfulness": 1-10, "clarity": 1-10 }
  }
}`;

    try {
      const evaluation = await this.getOpenAIResponse(
        selectionPrompt,
        'You are an impartial AI evaluator. Respond only with valid JSON.',
        { temperature: 0.3 }
      );

      const parsed = JSON.parse(evaluation.content);
      return {
        winner: parsed.selected === 'A' ? 'openai' : 'claude',
        content: parsed.selected === 'A' ? openaiResult.content : claudeResult.content,
        reasoning: parsed.reasoning,
        scores: parsed.scores
      };
    } catch (error) {
      // Default to Claude if evaluation fails
      logger.warn('Response selection failed, defaulting to Claude:', error.message);
      return {
        winner: 'claude',
        content: claudeResult.content,
        reasoning: 'Default selection due to evaluation error'
      };
    }
  }

  // Analyze patient data for care plan matching
  async analyzePatientForCarePlans(patientData, availableCarePlans) {
    const systemPrompt = `You are a healthcare analytics AI assistant specializing in patient care plan matching.
Analyze patient data and recommend appropriate care plans based on:
- Current diagnoses (ICD-10 codes)
- Risk factors
- Demographics
- Care gaps

Provide structured recommendations with confidence scores.`;

    const prompt = `
Patient Data:
${JSON.stringify(patientData, null, 2)}

Available Care Plans:
${JSON.stringify(availableCarePlans, null, 2)}

Analyze this patient and recommend suitable care plans. For each recommendation, provide:
1. Care plan name
2. Match confidence (0-100%)
3. Key matching criteria
4. Potential barriers
5. Expected outcomes

Respond in JSON format:
{
  "recommendations": [
    {
      "carePlanId": "id",
      "carePlanName": "name",
      "confidence": 85,
      "matchingCriteria": ["criteria1", "criteria2"],
      "barriers": ["barrier1"],
      "expectedOutcomes": ["outcome1", "outcome2"],
      "priority": "high|medium|low"
    }
  ],
  "riskAssessment": {
    "overallRiskLevel": "high|medium|low",
    "riskFactors": ["factor1", "factor2"]
  },
  "careGaps": ["gap1", "gap2"]
}`;

    return this.getDualAnalysis(prompt, systemPrompt, {
      selectBest: true,
      selectionCriteria: 'clinical accuracy, completeness, actionability'
    });
  }

  // Generate personalized outreach content
  async generateOutreachContent(patientInfo, carePlan, outreachType = 'mail') {
    const systemPrompt = `You are a healthcare communications specialist.
Generate personalized, empathetic patient outreach content that:
- Uses warm, accessible language
- Clearly explains the care plan benefits
- Includes a clear call to action
- Respects patient privacy
- Follows healthcare communication best practices
- Is HIPAA compliant (no specific PHI in content)`;

    const prompt = `
Generate a ${outreachType} for this patient:

Patient: ${patientInfo.name}
Recommended Care Plan: ${carePlan.name}
Care Plan Description: ${carePlan.description}
Key Benefits: ${carePlan.benefits?.join(', ') || 'Improved health outcomes'}

Requirements:
- Professional but warm tone
- Clear explanation of the program
- Specific call to action
- Contact information placeholder
- ${outreachType === 'mail' ? 'Formal letter format' : 'Email format'}

Generate the content:`;

    return this.getDualAnalysis(prompt, systemPrompt, {
      selectBest: true,
      selectionCriteria: 'empathy, clarity, professionalism, call-to-action effectiveness'
    });
  }

  // Risk stratification analysis
  async performRiskStratification(patientPopulation) {
    const systemPrompt = `You are a population health analytics expert.
Analyze patient populations to identify high-risk individuals who would benefit from targeted interventions.
Consider chronic conditions, utilization patterns, and social determinants.`;

    const prompt = `
Analyze this patient population for risk stratification:

${JSON.stringify(patientPopulation, null, 2)}

Provide:
1. Risk tier assignments (High, Medium, Low)
2. Key risk factors for each tier
3. Recommended interventions by tier
4. Population health insights

Respond in JSON:
{
  "stratification": {
    "high": { "count": N, "characteristics": [], "interventions": [] },
    "medium": { "count": N, "characteristics": [], "interventions": [] },
    "low": { "count": N, "characteristics": [], "interventions": [] }
  },
  "topRiskFactors": [],
  "populationInsights": "",
  "recommendedActions": []
}`;

    return this.getDualAnalysis(prompt, systemPrompt, { selectBest: true });
  }

  // ICD-10 code analysis
  async analyzeICD10Patterns(icd10Data) {
    const systemPrompt = `You are a clinical coding and analytics expert.
Analyze ICD-10 diagnosis patterns to identify:
- Prevalent conditions
- Comorbidity patterns  
- Care plan opportunities
- Quality measure implications`;

    const prompt = `
Analyze these ICD-10 diagnosis patterns:

${JSON.stringify(icd10Data, null, 2)}

Provide insights on:
1. Most prevalent condition categories
2. Common comorbidity combinations
3. High-value care plan opportunities
4. Quality measure considerations (HEDIS, CMS)
5. Recommended population health strategies

Respond in structured JSON format.`;

    return this.getDualAnalysis(prompt, systemPrompt, { selectBest: true });
  }

  // Care gap identification
  async identifyCareGaps(patientData, qualityMeasures) {
    const systemPrompt = `You are a healthcare quality improvement specialist.
Identify care gaps by comparing patient data against evidence-based quality measures.
Focus on preventive care, chronic disease management, and screening compliance.`;

    const prompt = `
Identify care gaps for this patient:

Patient Data:
${JSON.stringify(patientData, null, 2)}

Quality Measures to Check:
${JSON.stringify(qualityMeasures, null, 2)}

For each gap identified, provide:
1. Gap description
2. Associated quality measure
3. Clinical urgency
4. Recommended intervention
5. Expected impact

Respond in JSON format.`;

    return this.getDualAnalysis(prompt, systemPrompt, { selectBest: true });
  }

  // Prepare fine-tuning dataset
  async generateFineTuningData(examples) {
    const formattedData = examples.map(example => ({
      messages: [
        { role: 'system', content: 'You are a healthcare analytics AI assistant.' },
        { role: 'user', content: example.prompt },
        { role: 'assistant', content: example.completion }
      ]
    }));

    return formattedData.map(d => JSON.stringify(d)).join('\n');
  }

  // Create embeddings for semantic search
  async createEmbedding(text) {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text
      });
      return response.data[0].embedding;
    } catch (error) {
      logger.error('Embedding creation error:', error.message);
      throw error;
    }
  }

  // Batch process multiple prompts
  async batchProcess(prompts, systemPrompt, options = {}) {
    const batchSize = options.batchSize || 5;
    const results = [];

    for (let i = 0; i < prompts.length; i += batchSize) {
      const batch = prompts.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(prompt => this.getDualAnalysis(prompt, systemPrompt, options))
      );
      results.push(...batchResults);
      
      // Rate limiting delay
      if (i + batchSize < prompts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }
}

module.exports = new AIService();
