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

// Configure controllers, enum JSON values, CORS and Swagger's Bearer input.
builder.Services.AddControllers().AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddCors(options => options.AddPolicy("Clients", policy => policy.WithOrigins(builder.Configuration.GetSection("AllowedClientOrigins").Get<string[]>() ?? ["http://localhost:3000", "http://localhost:5173"]).AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "Smart Solar Microgrid API", Version = "v1" });
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme { Name = "Authorization", In = ParameterLocation.Header, Type = SecuritySchemeType.Http, Scheme = "bearer", BearerFormat = "JWT" });
    options.AddSecurityRequirement(new OpenApiSecurityRequirement { [new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } }] = Array.Empty<string>() });
});

var app = builder.Build();

// Use forwarded headers for IIS, consistent errors, HTTPS, CORS and authorization.
app.UseForwardedHeaders(new ForwardedHeadersOptions { ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto });
app.UseMiddleware<ApiExceptionMiddleware>();
if (app.Environment.IsDevelopment()) { app.UseSwagger(); app.UseSwaggerUI(); }
// Local Android emulator testing uses the HTTP 5180 profile; production/IIS remains HTTPS-only.
if (!app.Environment.IsDevelopment()) app.UseHttpsRedirection();
app.UseCors("Clients");
app.UseAuthentication();
app.UseAuthorization();
// Serve the published React build from wwwroot alongside the API on IIS.
app.UseDefaultFiles();
app.UseStaticFiles();
app.MapControllers();
app.Run();

// Expose Program to optional integration-test projects.
public partial class Program { }

