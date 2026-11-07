/**
 * Manual test for the AI analysis service. Calls analyseSpeech on sample
 * speeches and prints a short report for each. Uses real API credit when
 * ANTHROPIC_API_KEY is set in server/.env.
 *
 * Run from the server/ folder:  npm run test:ai
 */
import "dotenv/config";
import { calculateSpeechStatistics } from "../services/statistics.js";
import { analyseSpeech } from "../services/analysis.js";
import { AnalysisProviderError, AnalysisUnavailableError } from "../services/analysisErrors.js";
import type { AnalyseSpeech, Feedback, Presentation } from "../routes/analyze.js";

// Compile-time check that the service matches Member 2's route interface.
const runAnalysis: AnalyseSpeech = analyseSpeech;

interface Sample {
  name: string;
  presentation: Presentation;
  transcript: string;
  durationSeconds: number;
  inspiration?: string;
}

const SAMPLES: Sample[] = [
  {
    name: "1. Recycling pitch to student council",
    presentation: {
      title: "Add recycling bins to every lecture hall",
      audience: "Student council members",
      purpose: "Persuade the council to fund recycling bins in all lecture halls",
      keyPoints: [
        "Most lecture-hall waste is recyclable",
        "The bins cost less than the current cleaning overtime",
        "Students already support the idea",
      ],
      desiredDurationMinutes: 2,
      tone: "Persuasive and friendly",
    },
    transcript:
      "hi everyone thanks for having me so um I want to talk about recycling in our lecture halls right now every lecture hall has one general waste bin and that's it " +
      "last week me and two friends sorted the rubbish from the boole lecture theatre after a busy day and we found that about two thirds of it was paper cans and plastic bottles stuff that could easily be recycled " +
      "um instead it all goes to landfill and that just doesn't fit with a university that says it cares about sustainability " +
      "so what we're asking for is simple put a recycling bin next to every general waste bin " +
      "uh I think it would make a real difference and I think people would use them so yeah that's basically it thanks",
    durationSeconds: 58,
  },
  {
    name: "2. Hackathon demo explainer for judges",
    presentation: {
      title: "How Stutterbox works",
      audience: "Hackathon judges with a technical background",
      purpose: "Explain clearly how the app turns a practice speech into feedback",
      keyPoints: [
        "The browser transcribes speech live",
        "The server calculates statistics like words per minute",
        "Claude gives feedback grounded in the transcript",
        "Privacy: no audio is uploaded",
      ],
      desiredDurationMinutes: 1,
      tone: "Clear and confident",
    },
    transcript:
      "so Stutterbox is a speech coach that runs in your browser you fill in what your talk is about and the key points you want to hit and then you just start speaking " +
      "while you talk the browser's speech recognition shows your words live on the screen when you stop we send the final transcript to our express server " +
      "the server works out the numbers itself things like your word count your words per minute and how many filler words it caught " +
      "then it sends the transcript the stats and your key points to Claude which writes feedback and every point it makes has to quote what you actually said " +
      "and you get a results page with strengths things to improve and which key points you covered so you can practise again",
    durationSeconds: 47,
  },
  {
    name: "3. Class presentation with inspiration text",
    presentation: {
      title: "Why sleep matters for students",
      audience: "First-year university classmates",
      purpose: "Inform classmates about how sleep affects learning and give practical tips",
      keyPoints: [
        "Sleep helps the brain store what you learned",
        "Most students sleep less than they need",
        "Three simple habits for better sleep",
      ],
      desiredDurationMinutes: 3,
      tone: "Informative and relatable",
    },
    transcript:
      "okay so today I'm going to talk about sleep and why it matters for us as students " +
      "when you sleep your brain goes over what you learned that day and it kind of files it away so it's easier to remember later " +
      "that's why pulling an all nighter before an exam often doesn't work as well as you think you might cram a lot in but you don't keep it " +
      "a lot of us don't get enough sleep I know I don't I'm usually on my phone until two in the morning " +
      "so my advice is try to get more sleep it really does help with your grades and your mood " +
      "anyway that's my presentation on sleep thank you",
    durationSeconds: 52,
    inspiration:
      "Picture the night before your exam. Picture the lamp, the notes, the clock. Now picture the morning: the facts you read at midnight are gone. " +
      "We do not fail because we are lazy. We fail because we are tired. So tonight, put the phone down. Tonight, close the notes. Tonight, sleep.",
  },
  {
    name: "4. Too short (microphone problem)",
    presentation: {
      title: "Test",
      audience: "Anyone",
      purpose: "Check the short-transcript path",
      keyPoints: ["Anything"],
      desiredDurationMinutes: 1,
      tone: "Neutral",
    },
    transcript: "hello can you",
    durationSeconds: 10,
  },
];

function isNotEnoughSpeech(feedback: Feedback): boolean {
  return feedback.overallAssessment.startsWith("We couldn't hear enough speech");
}

/** Checks each evidence quote against the transcript: exact text, then ignoring punctuation/case. */
function checkEvidence(feedback: Feedback, transcript: string): string {
  const quotes = [...feedback.strengths, ...feedback.improvements]
    .map((item) => item.evidence)
    .filter((quote): quote is string => quote !== undefined);
  if (quotes.length === 0) return "no evidence quotes returned";

  const normalise = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const exact = quotes.filter((quote) => transcript.toLowerCase().includes(quote.toLowerCase())).length;
  const loose = quotes.filter((quote) => normalise(transcript).includes(normalise(quote))).length;
  return `${quotes.length} quotes: ${exact} found exactly, ${loose} found ignoring punctuation/case`;
}

async function main(): Promise<void> {
  console.log(`API key present: ${process.env.ANTHROPIC_API_KEY?.trim() ? "yes" : "no"}`);
  console.log(`Model: ${process.env.ANTHROPIC_MODEL?.trim() || "(default in analysis.ts)"}\n`);

  let failed = false;

  for (const sample of SAMPLES) {
    const statistics = calculateSpeechStatistics(sample.transcript, sample.durationSeconds);
    const started = Date.now();
    let feedback: Feedback;

    try {
      feedback = await runAnalysis({
        presentation: sample.presentation,
        transcript: sample.transcript,
        statistics,
        ...(sample.inspiration ? { inspiration: sample.inspiration } : {}),
      });
    } catch (error) {
      failed = true;
      console.log(`=== ${sample.name} ===`);
      if (error instanceof AnalysisUnavailableError) {
        console.error("Result:        FAILED (AI configuration unavailable; check ANTHROPIC_API_KEY)");
        break;
      }
      if (error instanceof AnalysisProviderError) {
        console.error("Result:        FAILED (Claude request or response validation failed)");
      } else {
        console.error("Result:        FAILED (unexpected analysis test error)");
      }
      console.log();
      continue;
    }

    const seconds = ((Date.now() - started) / 1000).toFixed(1);

    const kind = isNotEnoughSpeech(feedback)
      ? "NOT ENOUGH SPEECH (Claude skipped)"
      : "REAL CLAUDE FEEDBACK";
    const expectedPoints = sample.presentation.keyPoints.length;
    const coverageOk = feedback.keyPointCoverage.length === expectedPoints;
    const wordingOk = feedback.keyPointCoverage.every(
      (entry, index) => entry.keyPoint === sample.presentation.keyPoints[index],
    );

    console.log(`=== ${sample.name} ===`);
    console.log(`Result:        ${kind}`);
    console.log(`Time:          ${seconds} s`);
    console.log(`Evidence:      ${checkEvidence(feedback, sample.transcript)}`);
    console.log(
      `Key points:    ${feedback.keyPointCoverage.length} of ${expectedPoints} ${coverageOk ? "(one per key point" + (wordingOk ? ", original wording)" : ", wording differs)") : "(MISMATCH)"}`,
    );
    console.log(`Counts:        ${feedback.strengths.length} strengths, ${feedback.improvements.length} improvements, ${feedback.nextSteps.length} next steps, rewrite: ${feedback.suggestedRewrite ? "yes" : "no"}`);
    console.log(JSON.stringify(feedback, null, 2));
    console.log();
  }

  if (failed) process.exitCode = 1;
}

await main();
