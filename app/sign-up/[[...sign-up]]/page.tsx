import { SignUp } from "@clerk/nextjs";
import { Footer } from "@/components/footer";

export default function SignUpPage() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 items-center justify-center py-16">
        <SignUp />
      </div>
      <Footer />
    </div>
  );
}
