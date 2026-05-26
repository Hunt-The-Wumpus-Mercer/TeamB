import type { ITrivia, QuestionPrompt } from "./ITrivia";

export default class trivia implements ITrivia {
    initialize(): void {
        
    }

    getNextQuestion(): QuestionPrompt {
return  {
    "question": "",
    "answers": [],
   "correctAnswerIndex": 0
};
    }

    getHint(): string {
       return ""; 
    }
}