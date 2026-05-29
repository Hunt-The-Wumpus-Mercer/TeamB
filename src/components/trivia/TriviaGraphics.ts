import type { ITrivia } from "./ITrivia";

export type TriviaChallengeResult = {
    isCorrect: boolean;
    numberOfQuestionsAsked: number;
};

export interface ITriviaGraphics {
    runChallenge(
        trivia: ITrivia,
        questionCount: number,
        requiredCorrectAnswers: number,
    ): Promise<TriviaChallengeResult>;

    close(): void;
}

export class TriviaGraphicsDOM implements ITriviaGraphics {
    private container: HTMLDivElement | null = null;

    public runChallenge(
        trivia: ITrivia,
        questionCount: number,
        requiredCorrectAnswers: number,
    ): Promise<TriviaChallengeResult> {
        this.close();
        trivia.initialize();

        this.container = document.createElement("div");
        Object.assign(this.container.style, {
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            backgroundColor: "#ffffff",
            padding: "24px",
            borderRadius: "12px",
            boxShadow: "0px 8px 24px rgba(0, 0, 0, 0.15)",
            zIndex: "10000",
            fontFamily: "sans-serif",
            minWidth: "320px",
            maxWidth: "480px",
            color: "#333333"
        });
        document.body.appendChild(this.container);

        let correctCount = 0;
        let questionsAsked = 0;

        return new Promise<TriviaChallengeResult>((resolve) => {
            const renderNext = () => {
                if (questionsAsked >= questionCount) {
                    const finalResult = correctCount >= requiredCorrectAnswers;
                    this.close();
                    resolve({
                        isCorrect: finalResult,
                        numberOfQuestionsAsked: questionsAsked
                    });
                    return;
                }

                let currentQuestion;
                try {
                    currentQuestion = trivia.getNextQuestion();
                } catch {
                    const finalResult = correctCount >= requiredCorrectAnswers;
                    this.close();
                    resolve({
                        isCorrect: finalResult,
                        numberOfQuestionsAsked: questionsAsked
                    });
                    return;
                }

                questionsAsked++;
                this.container!.innerHTML = "";

                const header = document.createElement("h3");
                header.textContent = `Question ${questionsAsked} of ${questionCount}`;
                Object.assign(header.style, { margin: "0 0 16px 0", color: "#666666" });
                this.container!.appendChild(header);

                const questionText = document.createElement("p");
                questionText.textContent = currentQuestion.question;
                Object.assign(questionText.style, { fontSize: "18px", fontWeight: "bold", margin: "0 0 20px 0" });
                this.container!.appendChild(questionText);

                const hintContainer = document.createElement("div");
                Object.assign(hintContainer.style, { margin: "0 0 16px 0", color: "#e67e22", fontSize: "14px", fontStyle: "italic" });
                this.container!.appendChild(hintContainer);

                currentQuestion.answers.forEach((answer, index) => {
                    const button = document.createElement("button");
                    button.textContent = answer;
                    Object.assign(button.style, {
                        display: "block",
                        width: "100%",
                        padding: "12px",
                        margin: "0 0 8px 0",
                        backgroundColor: "#f0f2f5",
                        border: "none",
                        borderRadius: "6px",
                        textAlign: "left",
                        cursor: "pointer",
                        fontSize: "16px"
                    });
                    button.onclick = () => {
                        if (index === currentQuestion!.correctAnswerIndex) {
                            correctCount++;
                        }
                        renderNext();
                    };
                    this.container!.appendChild(button);
                });

                const hintButton = document.createElement("button");
                hintButton.textContent = "Get Hint";
                Object.assign(hintButton.style, {
                    display: "block",
                    width: "100%",
                    padding: "8px",
                    marginTop: "12px",
                    backgroundColor: "transparent",
                    border: "1px solid #ccc",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "14px",
                    color: "#555"
                });
                hintButton.onclick = () => {
                    try {
                        hintContainer.textContent = trivia.getHint();
                    } catch (e: any) {
                        hintContainer.textContent = e.message;
                    }
                };
                this.container!.appendChild(hintButton);
            };

            renderNext();
        });
    }

    public close(): void {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.container = null;
    }
}