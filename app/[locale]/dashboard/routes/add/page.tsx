"use client";


import { Button } from "@/components/ui/button";
import { CityAutocomplete } from "@/components/CityAutocomplete";
import { DatePicker } from "@/components/DatePicker";
import { addRoute } from "@/app/actions/add-route";
import { useRouter } from "@/i18n/routing";
import { useState } from "react";
import { Loader2 } from "lucide-react";

export default function AddRoutePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    // State for inputs
    const [fromCity, setFromCity] = useState("");
    const [fromIata, setFromIata] = useState("");
    const [toCity, setToCity] = useState("");
    const [toIata, setToIata] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setLoading(true);
        const formData = new FormData(event.currentTarget);

        // Call Server Action
        const result = await addRoute(formData);

        if (result?.success) {
            router.push("/dashboard");
            router.refresh();
        } else {
            alert("Error adding route: " + (result?.error || "Unknown error"));
            setLoading(false);
        }
    }

    return (
        <div className="max-w-xl mx-auto bg-white p-8 rounded-xl shadow-lg border border-slate-100">
            <h1 className="text-2xl font-bold mb-6 text-slate-900">Track New Flight Path</h1>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                    {/* Origin & Destination */}
                    <div className="grid grid-cols-1 gap-4">
                        <CityAutocomplete
                            name="from"
                            label="Origin"
                            placeholder="Search city (e.g. Istanbul)"
                            defaultValue={fromCity}
                            defaultIataCode={fromIata}
                            onSelect={(city, iata) => {
                                setFromCity(city);
                                setFromIata(iata);
                            }}
                        />

                        <CityAutocomplete
                            name="to"
                            label="Destination"
                            placeholder="Search city (e.g. London)"
                            defaultValue={toCity}
                            defaultIataCode={toIata}
                            onSelect={(city, iata) => {
                                setToCity(city);
                                setToIata(iata);
                            }}
                        />
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <DatePicker
                                label="Start Date"
                                placeholder="Select date"
                                value={startDate}
                                onChange={setStartDate}
                                minDate={new Date()}
                            />
                            {/* Hidden input for server action */}
                            <input type="hidden" name="startDate" value={startDate} />
                        </div>
                        <div>
                            <DatePicker
                                label="End Date (Optional)"
                                placeholder="Select date"
                                value={endDate}
                                onChange={setEndDate}
                                minDate={startDate ? new Date(startDate) : new Date()}
                            />
                            {/* Hidden input for server action */}
                            <input type="hidden" name="endDate" value={endDate} />
                        </div>
                    </div>

                    {/* Cabin Class */}
                    <div>
                        <label className="text-sm font-semibold mb-2 block text-slate-700">Cabin Class</label>
                        <div className="relative">
                            <select
                                name="cabin"
                                className="w-full h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
                            >
                                <option value="ECONOMY">Economy</option>
                                <option value="PREMIUM_ECONOMY">Premium Economy</option>
                                <option value="BUSINESS">Business</option>
                                <option value="FIRST">First Class</option>
                            </select>
                            {/* Custom arrow for consistent styling */}
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-2">
                    <Button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-700 font-semibold h-12 text-base rounded-xl transition-all"
                        disabled={loading}
                    >
                        {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Saving Route...</> : "Start Tracking"}
                    </Button>
                </div>
            </form>
        </div>
    );
}
