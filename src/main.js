// Function: getSalesByLocation
// Path: src/main.js
import { Client, Databases, Query } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
  log("Starting getSalesByLocation function execution.");

  const APPWRITE_ENDPOINT = req.env['APPWRITE_ENDPOINT'];
  const APPWRITE_PROJECT = req.env['APPWRITE_PROJECT'];
  const APPWRITE_API_KEY = req.env['APPWRITE_API_KEY'];
  const APPWRITE_DATABASE_ID = req.env['APPWRITE_DATABASE_ID'];
  const ORDERS_COLLECTION_ID = req.env['ORDERS_COLLECTION_ID'];
  // If you store location names in a separate collection and link via ID:
  const LOCATION_COLLECTION_ID = req.env['LOCATION_COLLECTION_ID']; // Optional, if you need to fetch location names

  if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT || !APPWRITE_API_KEY || !APPWRITE_DATABASE_ID || !ORDERS_COLLECTION_ID) {
    error("Missing core environment variables!");
    return res.json({
      ok: false,
      error: "Server configuration error: Missing Appwrite credentials or collection IDs."
    }, 500);
  }

  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT)
    .setKey(APPWRITE_API_KEY);

  const databases = new Databases(client);

  const salesByLocation = {}; // To aggregate sales per location

  try {
    let ordersOffset = 0;
    const ordersLimit = 100;
    let hasMoreOrders = true;

    while (hasMoreOrders) {
      const ordersResponse = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        ORDERS_COLLECTION_ID,
        [Query.limit(ordersLimit), Query.offset(ordersOffset)]
      );

      log(`Fetched ${ordersResponse.documents.length} orders for sales by location.`);

      for (const order of ordersResponse.documents) {
        // --- IMPORTANT: Adjust this part based on your actual data model ---
        // Option 1: Order document directly stores a 'storeName' attribute
        const locationName = order.storeName;

        // Option 2: Order document stores a 'locationId' which links to a 'locations' collection
        // In this case, you'd need to fetch the location name using the ID:
        // const locationId = order.locationId;
        // let locationName;
        // if (locationId && LOCATION_COLLECTION_ID) {
        //   try {
        //     const locationDoc = await databases.getDocument(APPWRITE_DATABASE_ID, LOCATION_COLLECTION_ID, locationId);
        //     locationName = locationDoc.name; // Assuming 'name' is the attribute for location name
        //   } catch (locationErr) {
        //     log(`Could not find location for ID ${locationId}: ${locationErr.message}`);
        //     locationName = "Unknown Location"; // Fallback
        //   }
        // } else {
        //   locationName = "Unknown Location"; // Fallback if no ID
        // }
        // ------------------------------------------------------------------

        if (locationName && typeof order.totalAmount === 'number') {
          salesByLocation[locationName] = (salesByLocation[locationName] || 0) + order.totalAmount;
        } else {
          log(`Warning: Order ${order.$id} has no valid location or totalAmount.`);
        }
      }

      if (ordersResponse.documents.length < ordersLimit) {
        hasMoreOrders = false;
      } else {
        ordersOffset += ordersLimit;
      }
    }

    // Convert aggregated sales data into an array of objects
    const formattedSales = Object.keys(salesByLocation).map(name => ({
      name: name,
      sales: salesByLocation[name].toFixed(2), // Format sales as string with 2 decimal places
    }));

    // Sort by sales in descending order and take top 10 (or all if less than 10)
    const sortedSales = formattedSales.sort((a, b) => parseFloat(b.sales) - parseFloat(a.sales));

    log(`Sales by location generated for ${sortedSales.length} locations.`);

    return res.json({
      ok: true,
      salesByLocation: sortedSales,
    }, 200);

  } catch (err) {
    error(`Failed to get sales by location: ${err.message}`);
    return res.json({
      ok: false,
      error: `Failed to retrieve sales data: ${err.message}`
    }, 500);
  }
};