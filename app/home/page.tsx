import { Suspense } from "react";
import HomeScreen from "../components/HomeScreen";

export default function Page() {
  return (
    <Suspense>
      <HomeScreen />
    </Suspense>
  );
}
