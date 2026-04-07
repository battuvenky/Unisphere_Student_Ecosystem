import { QuestionThread } from "@/components/doubts/question-thread";

type QuestionDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function QuestionDetailPage({ params }: QuestionDetailPageProps) {
  const { id } = await params;

  return <QuestionThread questionId={id} />;
}
