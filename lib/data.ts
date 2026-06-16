import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { calculateAveragePriceMap, calculateLatestPriceMap } from "./scoring";
import type { Food, FoodWithDetails, Price, Score } from "./types";

export function buildFoodWithDetails(
  foods: readonly Food[],
  prices: readonly Price[],
  scores: readonly Score[]
): FoodWithDetails[] {
  const latestPriceMap = calculateLatestPriceMap(prices);
  const averagePriceMap = calculateAveragePriceMap(prices);
  const scoreMap = new Map(scores.map((score) => [score.food_id, score]));

  return foods.map((food) => ({
    ...food,
    price: latestPriceMap.get(food.id) ?? null,
    average_price_per_kg: averagePriceMap.get(food.id) ?? null,
    score: scoreMap.get(food.id) ?? null,
  }));
}

export function formatLastUpdated(value: string | null): string {
  if (!value) {
    return "Not available";
  }

  return new Date(value).toLocaleString("tr-TR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function useEatleeData() {
  const [foods, setFoods] = useState<FoodWithDetails[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!db) {
      setError("Firebase is not initialized");
      setLoading(false);
      return;
    }

    let foodsData: Food[] = [];
    let pricesData: Price[] = [];
    let scoresData: Score[] = [];

    const updateData = () => {
      const combined = buildFoodWithDetails(foodsData, pricesData, scoresData);
      setFoods(combined);
      setLastUpdated(pricesData[0]?.updated_at ?? null);
      setLoading(false);
    };

    const unsubFoods = onSnapshot(query(collection(db, "foods"), orderBy("name")), (snap) => {
      foodsData = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Food[];
      if (pricesData.length && scoresData.length) updateData();
    }, (err) => {
      console.error(err);
      setError(err.message);
    });

    const unsubPrices = onSnapshot(query(collection(db, "prices"), orderBy("updated_at", "desc")), (snap) => {
      pricesData = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Price[];
      if (foodsData.length && scoresData.length) updateData();
    }, (err) => {
      console.error(err);
      setError(err.message);
    });

    const unsubScores = onSnapshot(query(collection(db, "scores"), orderBy("global_rank")), (snap) => {
      scoresData = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Score[];
      if (foodsData.length && pricesData.length) updateData();
      else if (foodsData.length && pricesData.length === 0) updateData(); // Handle case where prices might be empty initially
    }, (err) => {
      console.error(err);
      setError(err.message);
    });

    return () => {
      unsubFoods();
      unsubPrices();
      unsubScores();
    };
  }, []);

  return { foods, lastUpdated, loading, error };
}
