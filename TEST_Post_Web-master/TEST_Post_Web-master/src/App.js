import "./App.css";
import { ConfigProvider } from "antd";
import TopNavbar from "./components/TopNavbar";
import { Provider } from "react-redux";
import { store } from "./store";
import Posts from "./components/Posts";
import { PersistGate } from "redux-persist/integration/react";
import { persistor } from "./configureStore";

function App() {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <ConfigProvider>
          <main className="h-full w-screen">
            <TopNavbar />
            <Posts />
          </main>
        </ConfigProvider>
      </PersistGate>
    </Provider>
  );
}

export default App;
