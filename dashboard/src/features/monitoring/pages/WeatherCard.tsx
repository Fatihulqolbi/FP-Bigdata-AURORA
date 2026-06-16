import { useState, useEffect } from "react";

export default function WeatherCard() {
  const [time, setTime] = useState(new Date());
  const [weather, setWeather] = useState<{ temp: number; condition: string; icon: string } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetch(
      "https://api.openweathermap.org/data/2.5/weather?q=Surabaya&units=metric&appid=747f88191af5092eea65dcb7786af771"
    )
      .then((res) => {
        if (!res.ok) throw new Error("API Key invalid or inactive");
        return res.json();
      })
      .then((data) => {
        if (data && data.main) {
          setWeather({
            temp: Math.round(data.main.temp),
            condition: data.weather[0].main,
            icon: data.weather[0].icon,
          });
        }
      })
      .catch(() => {
        setWeather({ temp: 32, condition: "Cerah", icon: "01d" });
      });
  }, []);

  return (
    <div className="card">
      <div className="info-section">
        <div className="left-side">
          <div className="weather">
            <div>
              {weather ? (
                <img
                  src={`https://openweathermap.org/img/wn/${weather.icon}.png`}
                  alt="weather icon"
                  style={{ width: "24px", height: "24px", filter: "brightness(0) invert(1)" }}
                />
              ) : (
                <svg
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{ width: "24px", height: "24px" }}
                >
                  <path d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.759-1.549 3.5 3.5 0 11-7.39 8.529z" />
                </svg>
              )}
            </div>
            <div>{weather ? weather.condition : "Memuat"}</div>
          </div>
          <div className="temperature">{weather ? `${weather.temp}°` : "--°"}</div>
        </div>
        <div className="right-side">
          <div>
            <div className="hour">
              {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
            <div className="date">
              {time.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })}
            </div>
          </div>
          <div>Surabaya</div>
        </div>
        <div className="background-design">
          <div className="circle"></div>
          <div className="circle"></div>
          <div className="circle"></div>
        </div>
      </div>
      <div className="days-section">
        <button>
          <div className="day">HARI INI</div>
        </button>
        <button>
          <div className="day">BESOK</div>
        </button>
      </div>
    </div>
  );
}
