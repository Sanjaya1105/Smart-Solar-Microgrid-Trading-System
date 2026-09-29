// Bind and validate required service configuration at application startup.
builder.Services.AddOptions<MongoDbSettings>().Bind(builder.Configuration.GetSection(MongoDbSettings.SectionName)).Validate(x => !string.IsNullOrWhiteSpace(x.ConnectionString), "MongoDb:ConnectionString is required.").ValidateOnStart();
builder.Services.AddOptions<JwtSettings>().Bind(builder.Configuration.GetSection(JwtSettings.SectionName)).Validate(x => x.Key.Length >= 32 && x.QrSigningKey.Length >= 32, "JWT and QR keys must be at least 32 characters.").ValidateOnStart();
var jwt = builder.Configuration.GetSection(JwtSettings.SectionName).Get<JwtSettings>() ?? throw new InvalidOperationException("JWT configuration is missing.");

// Register the MongoDB context and all FAT-service business components.
builder.Services.AddSingleton<MongoDbContext>();
builder.Services.AddSingleton<PasswordService>();
builder.Services.AddSingleton<TokenService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<UserService>();
builder.Services.AddScoped<StationService>();
builder.Services.AddScoped<NearbyStationService>();
builder.Services.AddScoped<ReservationService>();
builder.Services.AddHostedService<DatabaseInitializer>();

// Bind and validate required service configuration at application startup.
builder.Services.AddOptions<MongoDbSettings>().Bind(builder.Configuration.GetSection(MongoDbSettings.SectionName)).Validate(x => !string.IsNullOrWhiteSpace(x.ConnectionString), "MongoDb:ConnectionString is required.").ValidateOnStart();
builder.Services.AddOptions<JwtSettings>().Bind(builder.Configuration.GetSection(JwtSettings.SectionName)).Validate(x => x.Key.Length >= 32 && x.QrSigningKey.Length >= 32, "JWT and QR keys must be at least 32 characters.").ValidateOnStart();
var jwt = builder.Configuration.GetSection(JwtSettings.SectionName).Get<JwtSettings>() ?? throw new InvalidOperationException("JWT configuration is missing.");

// Register the MongoDB context and all FAT-service business components.
builder.Services.AddSingleton<MongoDbContext>();
builder.Services.AddSingleton<PasswordService>();
builder.Services.AddSingleton<TokenService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<UserService>();
builder.Services.AddScoped<StationService>();
builder.Services.AddScoped<NearbyStationService>();
builder.Services.AddScoped<ReservationService>();
builder.Services.AddHostedService<DatabaseInitializer>();

// Configure role-aware JWT bearer authentication for web and Android clients.
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true, ValidateAudience = true, ValidateLifetime = true, ValidateIssuerSigningKey = true,
        ValidIssuer = jwt.Issuer, ValidAudience = jwt.Audience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key)), ClockSkew = TimeSpan.FromMinutes(1)
    };
});
builder.Services.AddAuthorization();
