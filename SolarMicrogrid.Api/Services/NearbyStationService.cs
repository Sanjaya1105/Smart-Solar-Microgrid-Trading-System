/*
 * File: NearbyStationService.cs
 * Project: Smart Solar Microgrid Trading System
 * Purpose: Supplies distance-ranked live station data for the Android Google Map.
 */
using MongoDB.Driver;
using SolarMicrogrid.Api.Models;

namespace SolarMicrogrid.Api.Services;

public sealed class NearbyStationService(MongoDbContext db)
{
    public async Task<IReadOnlyList<object>> GetNearbyAsync(double latitude, double longitude, double radiusKm, CancellationToken cancellationToken)
    {
        // Calculate Haversine distances and return active nodes inside the requested radius.
        if (latitude is < -90 or > 90 || longitude is < -180 or > 180 || radiusKm is <= 0 or > 500)
            throw new ApiException(StatusCodes.Status400BadRequest, "Invalid location or radius (maximum 500 km).");
        var stations = await db.Stations.Find(x => x.Status == NodeStatus.Active).ToListAsync(cancellationToken);
        return stations.Select(x => new { station = x, distanceKm = DistanceKm(latitude, longitude, x.Latitude, x.Longitude) })
            .Where(x => x.distanceKm <= radiusKm).OrderBy(x => x.distanceKm).Cast<object>().ToList();
    }

    private static double DistanceKm(double lat1, double lon1, double lat2, double lon2)
    {
        // Apply the Haversine formula to two latitude/longitude points.
        const double earthRadiusKm = 6371.0;
        static double Radians(double value) => value * Math.PI / 180.0;
        var dLat = Radians(lat2 - lat1); var dLon = Radians(lon2 - lon1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) + Math.Cos(Radians(lat1)) * Math.Cos(Radians(lat2)) * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return earthRadiusKm * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }
}
