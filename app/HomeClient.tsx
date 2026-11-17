"use client";
import {useRouter} from "next/navigation";
import Landing from "./Landing";
import {startNavProgress} from "./NavProgress";

export default function HomeClient({price}: {price: {amount: string; currency: string}}) {
  const router = useRouter();
  return <Landing price={price} onRegister={() => { startNavProgress(); router.push("/register"); }} onLogin={() => { startNavProgress(); router.push("/login"); }}/>;
}
