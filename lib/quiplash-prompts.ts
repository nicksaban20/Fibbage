import type { QuiplashPrompt } from './game-types';

export const QUIPLASH_PROMPTS: QuiplashPrompt[] = [
    // Relationships & Dating
    { id: 'qp-1', text: "The worst thing to say on a first date", category: "Dating" },
    { id: 'qp-2', text: "A terrible pickup line", category: "Dating" },
    { id: 'qp-3', text: "What you should never text your ex", category: "Dating" },
    { id: 'qp-4', text: "The worst wedding toast ever", category: "Relationships" },
    { id: 'qp-5', text: "A bad reason to break up with someone", category: "Dating" },

    // Work & Career
    { id: 'qp-6', text: "The worst thing to say in a job interview", category: "Work" },
    { id: 'qp-7', text: "A terrible name for a startup", category: "Work" },
    { id: 'qp-8', text: "Something you shouldn't put on your resume", category: "Work" },
    { id: 'qp-9', text: "The worst office birthday cake message", category: "Work" },
    { id: 'qp-10', text: "A bad excuse for being late to work", category: "Work" },

    // Social Situations
    { id: 'qp-11', text: "The worst thing to yell during a moment of silence", category: "Social" },
    { id: 'qp-12', text: "Something you should never say at a funeral", category: "Social" },
    { id: 'qp-13', text: "A terrible thing to whisper to a stranger", category: "Social" },
    { id: 'qp-14', text: "What you shouldn't say when meeting your partner's parents", category: "Social" },
    { id: 'qp-15', text: "The worst thing to put on a birthday card", category: "Social" },

    // Random & Weird
    { id: 'qp-16', text: "A bad name for a pet goldfish", category: "Random" },
    { id: 'qp-17', text: "Something that would make cereal less appealing", category: "Random" },
    { id: 'qp-18', text: "The worst thing to find in your pocket", category: "Random" },
    { id: 'qp-19', text: "A rejected Ben & Jerry's flavor", category: "Random" },
    { id: 'qp-20', text: "The worst superhero power", category: "Random" },

    // Entertainment
    { id: 'qp-21', text: "A bad name for a rock band", category: "Entertainment" },
    { id: 'qp-22', text: "The worst movie sequel title", category: "Entertainment" },
    { id: 'qp-23', text: "A rejected Disney movie title", category: "Entertainment" },
    { id: 'qp-24', text: "The worst theme for a theme park", category: "Entertainment" },
    { id: 'qp-25', text: "A terrible song to play at a wedding", category: "Entertainment" },

    // Food
    { id: 'qp-26', text: "The worst pizza topping", category: "Food" },
    { id: 'qp-27', text: "A terrible new Oreo flavor", category: "Food" },
    { id: 'qp-28', text: "Something you shouldn't put in a smoothie", category: "Food" },
    { id: 'qp-29', text: "The worst thing to find in your soup", category: "Food" },
    { id: 'qp-30', text: "A rejected Starbucks drink name", category: "Food" },

    // Animals
    { id: 'qp-31', text: "What your dog is actually thinking", category: "Animals" },
    { id: 'qp-32', text: "The worst animal to have as a pet", category: "Animals" },
    { id: 'qp-33', text: "A bad name for a zoo", category: "Animals" },
    { id: 'qp-34', text: "What a cat would say if it could talk", category: "Animals" },
    { id: 'qp-35', text: "The worst thing to teach a parrot to say", category: "Animals" },

    // History & Education
    { id: 'qp-36', text: "A terrible yearbook quote", category: "Education" },
    { id: 'qp-37', text: "The worst thing to write on a test you don't know", category: "Education" },
    { id: 'qp-38', text: "A rejected national holiday", category: "History" },
    { id: 'qp-39', text: "A bad slogan for a history museum", category: "History" },
    { id: 'qp-40', text: "The worst advice from a fortune cookie", category: "Random" },

    // Technology
    { id: 'qp-41', text: "A terrible password", category: "Technology" },
    { id: 'qp-42', text: "The worst new app idea", category: "Technology" },
    { id: 'qp-43', text: "Something Siri should never say", category: "Technology" },
    { id: 'qp-44', text: "A bad WiFi network name", category: "Technology" },
    { id: 'qp-45', text: "The worst feature for the next iPhone", category: "Technology" },

    // Opinions
    { id: 'qp-46', text: "An unpopular opinion that would get you canceled", category: "Opinions" },
    { id: 'qp-47', text: "Something you'd never admit publicly", category: "Opinions" },
    { id: 'qp-48', text: "The most controversial thing about pineapple pizza", category: "Opinions" },
    { id: 'qp-49', text: "A hill you would die on", category: "Opinions" },
    { id: 'qp-50', text: "The worst hot take", category: "Opinions" },

    // Fill in the blank
    { id: 'qp-51', text: "I can't believe it's not _____!", category: "Fill-in" },
    { id: 'qp-52', text: "That's what _____ said", category: "Fill-in" },
    { id: 'qp-53', text: "Houston, we have a _____", category: "Fill-in" },
    { id: 'qp-54', text: "To be or not to be _____", category: "Fill-in" },
    { id: 'qp-55', text: "One small step for man, one giant leap for _____", category: "Fill-in" },

    // Hypotheticals
    { id: 'qp-56', text: "What would Florida Man do?", category: "Hypothetical" },
    { id: 'qp-57', text: "If aliens visited Earth, what would confuse them most?", category: "Hypothetical" },
    { id: 'qp-58', text: "The first thing you'd do with a time machine", category: "Hypothetical" },
    { id: 'qp-59', text: "What would you do with a billion dollars (but you have to spend it all today)?", category: "Hypothetical" },
    { id: 'qp-60', text: "What's the worst way to become famous?", category: "Hypothetical" },

    // More prompts
    { id: 'qp-61', text: "A terrible name for a boy band", category: "Entertainment" },
    { id: 'qp-62', text: "The worst thing to hear from your doctor", category: "Random" },
    { id: 'qp-63', text: "Something you shouldn't Google at work", category: "Work" },
    { id: 'qp-64', text: "A bad reason to call 911", category: "Random" },
    { id: 'qp-65', text: "The worst thing to put on a license plate", category: "Random" },
    { id: 'qp-66', text: "A rejected breakfast cereal mascot", category: "Food" },
    { id: 'qp-67', text: "The worst thing to say when pulled over by the police", category: "Social" },
    { id: 'qp-68', text: "Something you shouldn't say to your boss", category: "Work" },
    { id: 'qp-69', text: "A terrible GPS voice option", category: "Technology" },
    { id: 'qp-70', text: "The worst thing to whisper in someone's ear", category: "Social" },
    { id: 'qp-71', text: "A bad name for a children's book", category: "Entertainment" },
    { id: 'qp-72', text: "Something you shouldn't put in a time capsule", category: "Random" },
    { id: 'qp-73', text: "The worst thing to say after 'I love you'", category: "Relationships" },
    { id: 'qp-74', text: "A terrible name for a gym", category: "Random" },
    { id: 'qp-75', text: "What your therapist really thinks about you", category: "Random" },
    { id: 'qp-76', text: "The worst thing to write in a sympathy card", category: "Social" },
    { id: 'qp-77', text: "A bad name for a new country", category: "Random" },
    { id: 'qp-78', text: "Something you shouldn't say at Thanksgiving dinner", category: "Social" },
    { id: 'qp-79', text: "The worst thing to find under your bed", category: "Random" },
    { id: 'qp-80', text: "A terrible slogan for a dating app", category: "Dating" },
    { id: 'qp-81', text: "What your Uber driver is really thinking", category: "Random" },
    { id: 'qp-82', text: "The worst thing to say when someone sneezes", category: "Social" },
    { id: 'qp-83', text: "A rejected superhero name", category: "Entertainment" },
    { id: 'qp-84', text: "Something that would ruin a vacation", category: "Random" },
    { id: 'qp-85', text: "The worst thing to yell in a library", category: "Social" },
    { id: 'qp-86', text: "A bad name for a restaurant", category: "Food" },
    { id: 'qp-87', text: "Something you'd find in a haunted house gift shop", category: "Random" },
    { id: 'qp-88', text: "The worst thing to put on a bumper sticker", category: "Random" },
    { id: 'qp-89', text: "A terrible name for a cruise ship", category: "Random" },
    { id: 'qp-90', text: "What ghosts do when they're not haunting", category: "Random" },
    { id: 'qp-91', text: "The worst thing to say at your own birthday party", category: "Social" },
    { id: 'qp-92', text: "A rejected candy bar name", category: "Food" },
    { id: 'qp-93', text: "Something you shouldn't say to a pilot", category: "Random" },
    { id: 'qp-94', text: "The worst motivational poster", category: "Random" },
    { id: 'qp-95', text: "A bad name for a perfume", category: "Random" },
    { id: 'qp-96', text: "What really happens at Area 51", category: "Random" },
    { id: 'qp-97', text: "The worst thing to put in a piñata", category: "Random" },
    { id: 'qp-98', text: "A terrible new Olympic sport", category: "Random" },
    { id: 'qp-99', text: "Something you shouldn't say at a baby shower", category: "Social" },
    { id: 'qp-100', text: "The worst thing to ask Alexa", category: "Technology" },
];

export function getQuiplashPrompts(): QuiplashPrompt[] {
    return QUIPLASH_PROMPTS;
}
