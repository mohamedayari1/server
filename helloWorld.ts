console.log("Hello, World! 🚀");
console.log("Your TypeScript + Bun environment is working!");

// Add some basic TypeScript features to test
const greeting: string = "Welcome to your development environment";
const version: number = 1.0;
const isWorking: boolean = true;

console.log(`${greeting} v${version} - Status: ${isWorking ? "✅ Working" : "❌ Not working"}`);

// Test async functionality
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  console.log("Testing async functionality...");
  await delay(1000);
  console.log("Async test completed! 🎉");
})();