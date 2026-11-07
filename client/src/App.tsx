import { useEffect, useState } from "react";

function App() {
  const [status, setStatus] = useState("Checking connection...");

  useEffect(() => {
    fetch("/api/health")
      .then((response) => response.json())
      .then((data) => setStatus(data.status))
      .catch(() => setStatus("Connection failed"));
  }, []);

  return (
    <div>
      <h1>Speech Coach</h1>
      <p>Backend status: {status}</p>
    </div>
  );
}

export default App;