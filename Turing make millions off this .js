import React, {useState} from "react";
import API from "./api";
import Chat from "./components/Chat";
import MatchList from "./components/MatchList";

export default function App(){
  const [username, setUsername] = useState("");
  const [userId, setUserId] = useState(1); // demo: pick user 1
  const [recs, setRecs] = useState([]);

  const loadRecs = async () => {
    const res = await fetch(`${API}/match/${userId}`);
    const j = await res.json();
    setRecs(j);
  };

  return (
    <div className="container">
      <header><h1>SmartMatch</h1><p className="tag">Light romantic • AI-powered</p></header>
      <div className="main">
        <div className="left">
          <h3>Chat (demo)</h3>
          <Chat userId={userId} />
        </div>
        <div className="right">
          <h3>Recommendations</h3>
          <button onClick={loadRecs}>Load Matches</button>
          <MatchList recs={recs} />
        </div>
      </div>
    </div>
  );
}