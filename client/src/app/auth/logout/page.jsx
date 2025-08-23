"use client";
import ThemeToggle from "../../../components/ThemeToggle"; // Import ThemeToggle
import { useAuth } from "../../Hooks/useAuth"; // Assuming useAuth is a custom hook

function MainComponent() {
  const { logout } = useAuth();

  const handleSignOut = async () => {
    await logout({
      callbackUrl: "/",
      redirect: true,
    });
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-between px-4 md:px-16 bg-background-light dark:bg-background-dark">
      <div className="flex flex-col items-start space-y-8 w-full md:w-1/2">
        <h1 className="text-4xl md:text-6xl font-header text-text-light dark:text-text-dark">
          Hope I will
          <br />
          see you again
        </h1>

        <button
          onClick={handleSignOut}
          className="w-full md:w-64 rounded-full bg-primary-light dark:bg-primary-dark px-6 py-4 text-base font-medium text-text-light dark:text-text-dark transition-colors hover:bg-primary-light dark:hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary-light dark:focus:ring-primary-dark focus:ring-offset-2 font-button"
        >
          Sign Out
        </button>
      </div>

      <div className="hidden md:flex w-1/2 justify-center items-center">
        <img
          src="/Graphic 1.png"
          alt="Person reading a book with floating elements"
          className="w-[500px]"
        />
      </div>

      <ThemeToggle /> {/* Add ThemeToggle component */}
    </div>
  );
}

export default MainComponent;

