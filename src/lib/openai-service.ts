import OpenAI from 'openai';
import { logger } from './logger';

// OpenAI client - configured for server-side use only
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type OpenAiModel = 'gpt-5' | 'gpt-5-mini' | 'gpt-5-nano' | 'gpt-4o' | 'gpt-4o-mini' | 'gpt-3.5-turbo';

export interface ModelSelectionParams {
  cellCount: number;
  prompt: string;
  sampleCellValue: string;
}

export interface AiTransformRequest {
  prompt: string;
  cellValue: string;
  model: OpenAiModel;
}

export interface AiTransformResponse {
  transformedValue: string;
  reasoning?: string; // AI's thinking process (if available)
  tokensUsed?: number;
}

export interface ModelSelectionResult {
  model: OpenAiModel;
  reason: string;
  complexityFactors: {
    isVeryComplexPrompt: boolean;
    isComplexPrompt: boolean;
    isComplexData: boolean;
    isSimpleTask: boolean;
    cellCount: number;
    promptLength: number;
    cellValueLength: number;
  };
}

/**
 * Intelligently selects the optimal OpenAI model based on task complexity and batch size
 *
 * Decision logic (GPT-5 models prioritized):
 * - Small batch (≤3 cells) + very complex/reasoning task → GPT-5 (best quality, reasoning model)
 * - Small batch (≤10 cells) + complex task → GPT-5-mini (excellent quality, cost-effective)
 * - Large batch (>50 cells) + simple task → GPT-5-nano (most cost-efficient)
 * - Medium batch + complex task → GPT-5-mini (balanced)
 * - Default → GPT-5-mini (best balanced choice)
 *
 * Pricing (per 1M tokens):
 * - GPT-5: $1.25 input / $10.00 output (reasoning, best quality)
 * - GPT-5-mini: $0.25 input / $2.00 output (balanced)
 * - GPT-5-nano: $0.05 input / $0.40 output (cost-efficient)
 */
export function selectOptimalModel({ cellCount, prompt, sampleCellValue }: ModelSelectionParams): ModelSelectionResult {
  // Complexity indicators
  const isVeryComplexPrompt = prompt.length > 150 ||
    /reason|logic|infer|deduce|critical|analysis|comprehend|sophisticated/i.test(prompt);

  const isComplexPrompt = prompt.length > 100 ||
    /analyz|interpret|understand|complex|difficult|translate|scientific|taxonomy|transform|classify/i.test(prompt);

  const isComplexData = sampleCellValue.length > 50 ||
    /[^a-zA-Z0-9\s,.-]/.test(sampleCellValue);

  const isSimpleTask = /add|remove|replace|format|convert|change|uppercase|lowercase|trim|strip|pad/i.test(prompt) &&
    prompt.length < 50;

  // OPTIMIZATION: Detect taxonomic classification tasks
  const isTaxonomicTask = /taxonom|species|genus|family|order|class|phylum|rank|classify|worms|scientific\s+name/i.test(prompt);

  const complexityFactors = {
    isVeryComplexPrompt,
    isComplexPrompt,
    isComplexData,
    isSimpleTask,
    cellCount,
    promptLength: prompt.length,
    cellValueLength: sampleCellValue.length
  };

  // OPTIMIZATION: Use fast, cheap model for taxonomic work
  if (isTaxonomicTask) {
    const reason = 'Taxonomic classification detected - using fast, cost-efficient model (gpt-4o-mini)';
    logger.info('Selected GPT-4o-mini: Taxonomic classification task', {
      context: 'model-selection',
      data: { ...complexityFactors, isTaxonomicTask: true }
    });
    return { model: 'gpt-4o-mini', reason, complexityFactors };
  }

  // Decision tree for non-taxonomic tasks
  if (cellCount <= 3 && (isVeryComplexPrompt || (isComplexPrompt && isComplexData))) {
    // Very small batch + very complex task → Use GPT-5 reasoning model
    const reason = 'Very small batch (≤3 cells) with complex reasoning task detected';
    logger.info('Selected GPT-5: Very small batch with complex reasoning task', {
      context: 'model-selection',
      data: complexityFactors
    });
    return { model: 'gpt-5', reason, complexityFactors };
  } else if (cellCount <= 10 && (isComplexPrompt || isComplexData)) {
    // Small batch + complex task → Use GPT-5-mini for excellent quality
    const reason = 'Small batch (≤10 cells) with complex task or data detected';
    logger.info('Selected GPT-5-mini: Small batch with complex task', {
      context: 'model-selection',
      data: complexityFactors
    });
    return { model: 'gpt-5-mini', reason, complexityFactors };
  } else if (isSimpleTask && cellCount > 50) {
    // Large batch + simple task → Use GPT-4o-mini for speed
    const reason = 'Large batch (>50 cells) with simple task - optimizing for speed and cost';
    logger.info('Selected GPT-4o-mini: Large batch with simple task', {
      context: 'model-selection',
      data: complexityFactors
    });
    return { model: 'gpt-4o-mini', reason, complexityFactors };
  } else if (cellCount > 100) {
    // Very large batch → Use gpt-4o-mini for speed and cost
    const reason = 'Very large batch (>100 cells) - optimizing for speed and cost';
    logger.info('Selected GPT-4o-mini: Very large batch', {
      context: 'model-selection',
      data: complexityFactors
    });
    return { model: 'gpt-4o-mini', reason, complexityFactors };
  } else {
    // Default: GPT-4o-mini is the best balanced choice
    const reason = 'Default balanced choice - fast and cost-efficient';
    logger.info('Selected GPT-4o-mini: Default balanced choice', {
      context: 'model-selection',
      data: complexityFactors
    });
    return { model: 'gpt-4o-mini', reason, complexityFactors };
  }
}

/**
 * Transforms a single cell value using OpenAI's chat completion API
 *
 * @param prompt - User's transformation instruction
 * @param cellValue - The cell value to transform
 * @param model - OpenAI model to use
 * @returns Transformed cell value with reasoning, or original value if transformation fails
 */
export async function transformCellValue({ prompt, cellValue, model }: AiTransformRequest): Promise<AiTransformResponse> {
  const systemPrompt = `You are a data transformation assistant. The user will provide:
1. A transformation instruction
2. A cell value to transform

Your task: Apply the instruction to the cell value and return ONLY the transformed value.
Do not include explanations, markdown formatting, quotes, or additional text.
Return ONLY the transformed value, nothing else.
If the instruction cannot be applied, return the original value unchanged.

IMPORTANT FOR TAXONOMIC/SPECIES NAME TRANSFORMATIONS:
- If the instruction involves taxonomic classification, species names, or marine biology terms:
  * ALWAYS verify spelling against the WoRMS database (World Register of Marine Species)
  * Correct any misspellings to the accepted valid scientific name
  * Use the accepted/valid name if the input is a synonym
  * Examples of common misspellings to watch for:
    - "Trisopterus iuscus" → should be "Trisopterus luscus"
    - "Spratus spratus" → should be "Sprattus sprattus"
  * Always double-check species spellings before returning

Examples:
- Instruction: "Convert to uppercase" | Cell: "hello" | Output: HELLO
- Instruction: "Add hyphen between words" | Cell: "hello world" | Output: hello-world
- Instruction: "Convert date to DD/MM/YYYY" | Cell: "2024-01-15" | Output: 15/01/2024
- Instruction: "Make this shorter" | Cell: "Ammodytidae spp." | Output: Ammodytidae
- Instruction: "Format with rank" | Cell: "Trisopterus iuscus" | Output: Trisopterus luscus (sp.)`;

  const userPrompt = `Instruction: ${prompt}

Cell value: ${cellValue}

Transformed value:`;

  try {
    // GPT-5 models have different parameter requirements:
    // - Use max_completion_tokens instead of max_tokens
    // - Only support temperature=1 (default), custom values not allowed
    // - GPT-5 has reasoning/thinking capability, so needs higher token limit (2000 instead of 500)
    //   because "thinking" tokens count against the limit
    const isGpt5 = model.startsWith('gpt-5');

    // Debug logging to verify model detection
    logger.info('🔍 Model detection check', {
      context: 'openai-service',
      data: {
        model,
        modelType: typeof model,
        modelLength: model.length,
        firstChars: model.substring(0, 5),
        isGpt5,
        startsWithCheck: model.startsWith('gpt-5')
      }
    });

    const tokenParam = isGpt5 ? { max_completion_tokens: 2000 } : { max_tokens: 500 };
    const temperatureParam = isGpt5 ? {} : { temperature: 0.1 };

    const apiCallParams = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      ...temperatureParam,
      ...tokenParam,
    };

    logger.info('Making OpenAI API request', {
      context: 'openai-service',
      data: {
        model,
        isGpt5,
        promptLength: prompt.length,
        cellValueLength: cellValue.length,
        tokenParam,
        temperatureParam: isGpt5 ? 'default (1.0)' : 0.1,
        tokenLimit: isGpt5 ? '2000 (higher for GPT-5 reasoning)' : '500',
        actualApiParams: {
          model: apiCallParams.model,
          temperature: (apiCallParams as any).temperature,
          max_tokens: (apiCallParams as any).max_tokens,
          max_completion_tokens: (apiCallParams as any).max_completion_tokens
        }
      }
    });

    const response = await openai.chat.completions.create(apiCallParams);

    let rawContent = response.choices[0]?.message?.content?.trim() || '';

    // 🔍 DETAILED LOGGING: Step 1 - Raw Response
    logger.info('🔍 Step 1: Raw OpenAI Response', {
      context: 'openai-service',
      data: {
        model,
        originalCellValue: cellValue,
        originalLength: cellValue.length,
        rawResponseContent: rawContent,
        rawResponseLength: rawContent.length,
        tokensUsed: response.usage?.total_tokens
      }
    });

    // Extract reasoning if present (for GPT-5 models with thinking)
    let reasoning: string | undefined;

    // Clean up the response - remove common formatting artifacts
    let result = rawContent;

    // Remove markdown code blocks
    const afterCodeBlockRemoval = result.replace(/```[\s\S]*?```/g, '').trim();
    const afterInlineCodeRemoval = afterCodeBlockRemoval.replace(/`([^`]+)`/g, '$1').trim();
    result = afterInlineCodeRemoval;

    // 🔍 DETAILED LOGGING: Step 2 - After Code Block Removal
    if (result !== rawContent) {
      logger.info('🔍 Step 2: After Code Block Removal', {
        context: 'openai-service',
        data: {
          beforeLength: rawContent.length,
          afterLength: result.length,
          resultAfterCleanup: result,
          removedContent: rawContent !== result
        }
      });
    }

    // Remove quotes if the entire response is quoted
    if ((result.startsWith('"') && result.endsWith('"')) ||
        (result.startsWith("'") && result.endsWith("'"))) {
      const beforeQuoteRemoval = result;
      result = result.slice(1, -1);

      // 🔍 DETAILED LOGGING: Step 3 - After Quote Removal
      logger.info('🔍 Step 3: After Quote Removal', {
        context: 'openai-service',
        data: {
          beforeQuoteRemoval,
          afterQuoteRemoval: result,
          hadQuotes: true
        }
      });
    }

    // Remove any "Transformed value:" or similar prefixes
    const beforePrefixRemoval = result;
    result = result.replace(/^(transformed value|output|result|answer):\s*/i, '').trim();

    if (result !== beforePrefixRemoval) {
      // 🔍 DETAILED LOGGING: Step 4 - After Prefix Removal
      logger.info('🔍 Step 4: After Prefix Removal', {
        context: 'openai-service',
        data: {
          beforePrefixRemoval,
          afterPrefixRemoval: result,
          removedPrefix: true
        }
      });
    }

    // 🔍 DETAILED LOGGING: Step 5 - Validation Check
    const maxAllowedLength = cellValue.length * 3;
    const isResultEmpty = !result;
    const isResultTooLong = result.length > maxAllowedLength;
    const willRejectResponse = isResultEmpty || isResultTooLong;

    logger.info('🔍 Step 5: Validation Check', {
      context: 'openai-service',
      data: {
        originalValue: cellValue,
        originalLength: cellValue.length,
        cleanedResult: result,
        cleanedResultLength: result.length,
        maxAllowedLength,
        isResultEmpty,
        isResultTooLong,
        willRejectResponse,
        rejectionReason: isResultEmpty ? 'Result is empty' : isResultTooLong ? `Result too long (${result.length} > ${maxAllowedLength})` : 'None - will accept'
      }
    });

    // If result is empty or suspiciously long (likely contains explanation), use original
    if (!result || result.length > cellValue.length * 3) {
      const wasEmpty = !result;
      const wasTooLong = result.length > cellValue.length * 3;

      result = cellValue;
      reasoning = `AI response was invalid or too verbose, kept original value. Raw response: "${rawContent.substring(0, 200)}${rawContent.length > 200 ? '...' : ''}"`;

      // 🔍 DETAILED LOGGING: Step 6 - Response Rejected
      logger.warn('❌ Step 6: Response REJECTED - Using Original Value', {
        context: 'openai-service',
        data: {
          originalValue: cellValue,
          rawResponse: rawContent,
          cleanedResponse: cellValue,
          wasEmpty,
          wasTooLong,
          rejectionReason: wasEmpty ? 'Empty result after cleaning (possible max_completion_tokens limit reached)' : 'Result too long',
          reasoningShownToUser: reasoning
        }
      });
    } else {
      // 🔍 DETAILED LOGGING: Step 6 - Response Accepted
      logger.info('✅ Step 6: Response ACCEPTED', {
        context: 'openai-service',
        data: {
          originalValue: cellValue,
          acceptedTransformation: result,
          transformationLength: result.length,
          maxAllowed: maxAllowedLength
        }
      });
    }

    logger.info('Cell transformation complete', {
      context: 'openai-service',
      data: {
        model,
        originalValue: cellValue,
        transformedValue: result,
        originalLength: cellValue.length,
        resultLength: result.length,
        tokensUsed: response.usage?.total_tokens,
        wasAccepted: result !== cellValue
      }
    });

    return {
      transformedValue: result,
      reasoning,
      tokensUsed: response.usage?.total_tokens
    };
  } catch (error) {
    // Extract detailed error information
    const errorDetails: any = {
      model,
      isGpt5Model: model.startsWith('gpt-5'),
      promptLength: prompt.length,
      cellValueLength: cellValue.length,
      cellValueSample: cellValue.substring(0, 100) + (cellValue.length > 100 ? '...' : ''),
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorType: error instanceof Error ? error.constructor.name : typeof error
    };

    // Extract OpenAI-specific error details if available
    if (error && typeof error === 'object') {
      const apiError = error as any;

      errorDetails.statusCode = apiError.status || apiError.statusCode;
      errorDetails.errorCode = apiError.code;
      errorDetails.errorType = apiError.type;
      errorDetails.errorParam = apiError.param;
      errorDetails.requestId = apiError.requestID || apiError.request_id;

      // Include request parameters that were used
      errorDetails.requestParameters = {
        model,
        temperature: model.startsWith('gpt-5') ? 'default (1.0)' : 0.1,
        tokenLimit: model.startsWith('gpt-5') ? 'max_completion_tokens: 2000' : 'max_tokens: 500',
        systemPromptLength: systemPrompt.length,
        userPromptLength: userPrompt.length
      };

      // Try to extract the full error body if available
      if (apiError.error && typeof apiError.error === 'object') {
        errorDetails.apiErrorDetails = {
          message: apiError.error.message,
          type: apiError.error.type,
          code: apiError.error.code,
          param: apiError.error.param
        };
      }
    }

    logger.error('❌ OpenAI API error during cell transformation', error as Error, {
      context: 'openai-service',
      data: errorDetails
    });

    // Create detailed user-facing error message
    const userErrorMessage = [
      `API Error: ${errorDetails.errorMessage}`,
      errorDetails.statusCode ? `Status: ${errorDetails.statusCode}` : '',
      errorDetails.errorCode ? `Code: ${errorDetails.errorCode}` : '',
      errorDetails.errorParam ? `Parameter: ${errorDetails.errorParam}` : '',
      `Model: ${model}`,
    ].filter(Boolean).join(' | ');

    // Return original value on error
    return {
      transformedValue: cellValue,
      reasoning: userErrorMessage,
      tokensUsed: 0
    };
  }
}
