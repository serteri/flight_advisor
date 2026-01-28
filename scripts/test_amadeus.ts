
import amadeus from '../lib/amadeus';

async function main() {
    console.log("Amadeus Instance Keys:", Object.keys(amadeus));

    if (amadeus.booking) {
        console.log("amadeus.booking exists");
        console.log("amadeus.booking keys:", Object.keys(amadeus.booking));

        if (amadeus.booking.flightOrders) {
            console.log("amadeus.booking.flightOrders exists");
        } else {
            console.log("amadeus.booking.flightOrders MISSING");
        }
    } else {
        console.log("amadeus.booking MISSING");
    }

    if (amadeus.shopping) {
        console.log("amadeus.shopping exists");
    }
}

main().catch(console.error);
