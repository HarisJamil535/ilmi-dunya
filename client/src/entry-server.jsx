import { renderToString } from "react-dom/server";
import { StrictMode } from 'react';
import { MemoryRouter } from "react-router-dom";
import AppProvider from "./context/AppProvider";
import App from './App';
import Home from "./student/pages/Home";
import News from "./student/pages/News";
import NewsArticle from "./student/pages/NewsArticle";
import PublicStudyPage from "./student/pages/PublicStudyPage";

export function render(data) {
  const View = data.type === "home" ? Home : data.type === "news" ? News : data.type === "article" ? NewsArticle : PublicStudyPage;
  return renderToString(<StrictMode><AppProvider initialData={data.context}><App routerComponent={MemoryRouter} routerProps={{ initialEntries: [data.requestPath] }} initialData={data} initialView={View} /></AppProvider></StrictMode>);
}
