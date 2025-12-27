// /src/components/login-screen.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";

// Define the type for the props we are accepting
interface LoginScreenProps {
  onLoginClick: () => void;
}

export default function LoginScreen({ onLoginClick }: LoginScreenProps) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold tracking-tight">
            Welcome to Vatic
          </CardTitle>
          <CardDescription className="pt-2">
            The fastest interface for prediction markets. <br />
            Correlate news, onchain activity and user behavior with markets and trade instantly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* You could add a visual element here later, like a simple graphic */}
        </CardContent>
        <CardFooter>
          <Button 
            className="w-full" 
            size="lg" 
            onClick={onLoginClick}
          >
            Connect to Start
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}