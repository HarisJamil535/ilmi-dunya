import { BrowserRouter } from "react-router-dom";
import StudentRoutes from "./routes/StudentRoutes";
import AdminRoutes from "./routes/AdminRoutes";

function App() {
  return (
    <BrowserRouter>
      <StudentRoutes />
      <AdminRoutes />
    </BrowserRouter>
  );
}

export default App;