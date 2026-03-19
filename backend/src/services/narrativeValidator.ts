/**
 * Narrative Validator for Rollia
 * Detects and reports issues with narrative quality
 * 
 * Usage:
 * const validation = narrativeValidator.validate(narrative, 'ru')
 * if (!validation.isValid) {
 *   console.warn('Issues found:', validation.issues)
 * }
 */

export type PreferredLanguage = 'en' | 'ru'

export interface ValidationIssue {
    type: 'meta_language' | 'anachronism' | 'incomplete_dialogue' | 'location_mismatch'
    message: string
    severity: 'critical' | 'warning'
    suggestion?: string
}

export interface ValidationResult {
    isValid: boolean
    issues: ValidationIssue[]
    hasCriticalIssues: boolean
}

export class NarrativeValidator {
    private metaLanguagePatternsRU = [
        /\bNPC\b/gi,
        /\bпроверка\b/gi,
        /\bуспех\b/gi,
        /\bитого\b/gi,
        /\bброс\b/gi,
        /\bкубик\b/gi,
        /\bHP\b/gi,
        /\bXP\b/gi,
        /\bтензия\b/gi,
        /\bнапряжение\b/gi
    ]

    private metaLanguagePatternsEN = [
        /\bNPC\b/gi,
        /\bcheck\b/gi,
        /\bsuccess\b/gi,
        /\btotal\b/gi,
        /\broll\b/gi,
        /\bdice\b/gi,
        /\bHP\b/gi,
        /\bXP\b/gi,
        /\btension\b/gi
    ]

    private anachronismsRU = [
        'бетон', 'пластик', 'асфальт', 'тротуар', 'решетка',
        'электричество', 'лампочка', 'стекло', 'автомобиль',
        'телефон', 'компьютер', 'интернет', 'радио', 'телевизор'
    ]

    private anachronismsEN = [
        'concrete', 'plastic', 'asphalt', 'sidewalk', 'grating',
        'electricity', 'lightbulb', 'glass', 'automobile',
        'telephone', 'computer', 'internet', 'radio', 'television'
    ]

    /**
     * Validate narrative text for common issues
     */
    validate(
        narrative: string,
        locale: PreferredLanguage = 'en',
        expectedLocation?: string
    ): ValidationResult {
        const issues: ValidationIssue[] = []

        if (!narrative || typeof narrative !== 'string') {
            return {
                isValid: false,
                issues: [{
                    type: 'meta_language',
                    message: locale === 'ru' ? 'Нарратив пуст' : 'Narrative is empty',
                    severity: 'critical'
                }],
                hasCriticalIssues: true
            }
        }

        // Check for meta-language
        const metaLanguagePatterns = locale === 'ru'
            ? this.metaLanguagePatternsRU
            : this.metaLanguagePatternsEN

        metaLanguagePatterns.forEach(pattern => {
            const matches = narrative.match(pattern)
            if (matches) {
                issues.push({
                    type: 'meta_language',
                    message: locale === 'ru'
                        ? `Обнаружен метаязык: "${matches[0]}"`
                        : `Detected meta-language: "${matches[0]}"`,
                    severity: 'critical',
                    suggestion: locale === 'ru'
                        ? 'Удалите упоминания механик игры из нарратива'
                        : 'Remove game mechanics mentions from narrative'
                })
            }
        })

        // Check for anachronisms
        const anachronisms = locale === 'ru'
            ? this.anachronismsRU
            : this.anachronismsEN

        anachronisms.forEach(term => {
            if (narrative.toLowerCase().includes(term.toLowerCase())) {
                issues.push({
                    type: 'anachronism',
                    message: locale === 'ru'
                        ? `Обнаружен анахронизм: "${term}"`
                        : `Detected anachronism: "${term}"`,
                    severity: 'critical',
                    suggestion: locale === 'ru'
                        ? `Замените на средневековый/фэнтези эквивалент`
                        : `Replace with medieval/fantasy equivalent`
                })
            }
        })

        // Check for incomplete dialogue
        const incompleteDialoguePattern = /[""].*\.\.\.$|[""].*[—–]$/gm
        const incompleteMatches = narrative.match(incompleteDialoguePattern)
        if (incompleteMatches) {
            issues.push({
                type: 'incomplete_dialogue',
                message: locale === 'ru'
                    ? 'Обнаружены неполные диалоги (заканчиваются на многоточие или тире)'
                    : 'Detected incomplete dialogues (ending with ellipsis or dash)',
                severity: 'warning',
                suggestion: locale === 'ru'
                    ? 'Завершите диалоги полными предложениями'
                    : 'Complete dialogues with full sentences'
            })
        }

        // Check for NPC tag consistency
        const npcTagPattern = /<npc\s+id="([^"]+)"/gi
        const npcTags = []
        let match
        while ((match = npcTagPattern.exec(narrative)) !== null) {
            npcTags.push(match[1])
        }

        // Check for "NPC" as plain text (not in tags)
        const plainNpcPattern = /\bNPC\b(?![\s]*id=)/gi
        if (plainNpcPattern.test(narrative)) {
            issues.push({
                type: 'meta_language',
                message: locale === 'ru'
                    ? 'Найдено упоминание "NPC" как текста (должно быть в тегах)'
                    : 'Found "NPC" as plain text (should be in tags)',
                severity: 'critical'
            })
        }

        // Check for location consistency
        if (expectedLocation && narrative.length > 0) {
            // This is a soft check - location changes should be rare
            const locationMentionCount = (narrative.match(new RegExp(expectedLocation, 'gi')) || []).length
            if (locationMentionCount === 0 && narrative.length > 200) {
                issues.push({
                    type: 'location_mismatch',
                    message: locale === 'ru'
                        ? `Локация "${expectedLocation}" не упоминается в нарративе`
                        : `Location "${expectedLocation}" is not mentioned in narrative`,
                    severity: 'warning',
                    suggestion: locale === 'ru'
                        ? 'Убедитесь, что нарратив соответствует текущей локации'
                        : 'Ensure narrative matches the current location'
                })
            }
        }

        const hasCriticalIssues = issues.some(i => i.severity === 'critical')

        return {
            isValid: !hasCriticalIssues,
            issues,
            hasCriticalIssues
        }
    }

    /**
     * Get a summary of validation issues for logging
     */
    getSummary(validation: ValidationResult, locale: PreferredLanguage = 'en'): string {
        if (validation.isValid) {
            return locale === 'ru' ? 'Нарратив прошёл валидацию' : 'Narrative passed validation'
        }

        const criticalCount = validation.issues.filter(i => i.severity === 'critical').length
        const warningCount = validation.issues.filter(i => i.severity === 'warning').length

        return locale === 'ru'
            ? `Найдено ${criticalCount} критических и ${warningCount} предупреждений`
            : `Found ${criticalCount} critical and ${warningCount} warnings`
    }
}

export const narrativeValidator = new NarrativeValidator()