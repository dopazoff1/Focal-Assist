package com.focal.api.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final CustomUserDetailsService userDetailsService;
    private final String allowedOriginPatterns;
    private final String frameAncestors;

    public SecurityConfig(
        JwtAuthenticationFilter jwtAuthenticationFilter,
        CustomUserDetailsService userDetailsService,
        @Value("${app.cors.allowed-origin-patterns:http://localhost:4200,http://127.0.0.1:4200,https://*.trycloudflare.com}") String allowedOriginPatterns,
        @Value("${app.frame-ancestors:'self' http://localhost:4200 http://127.0.0.1:4200}") String frameAncestors
    ) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.userDetailsService = userDetailsService;
        this.allowedOriginPatterns = allowedOriginPatterns;
        this.frameAncestors = frameAncestors;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .headers(h -> h
                .frameOptions(f -> f.disable())
                .contentSecurityPolicy(csp -> csp.policyDirectives("frame-ancestors " + frameAncestors))
            )
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((request, response, authException) -> {
                    response.setStatus(HttpStatus.UNAUTHORIZED.value());
                    response.setContentType("application/json");
                    response.getWriter().write("{\"status\":401,\"error\":\"Unauthorized\",\"message\":\"Session expired or invalid token\"}");
                })
            )
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authenticationProvider(authenticationProvider())
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .requestMatchers("/auth/login").permitAll()
                .requestMatchers("/auth/mfa/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/gmail/oauth/callback").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/gmail/attachment/**").permitAll()
                .requestMatchers("/api/crm/chats/oauth/callback").permitAll()
                .requestMatchers("/api/crm/chats/meta/webhook").permitAll()
                .requestMatchers("/api/crm/chats/widget/**").permitAll()
                .requestMatchers("/api/public/astra/**").permitAll()
                .requestMatchers("/api/public/chat/**").permitAll()
                .requestMatchers("/api/chat-project-api/**").permitAll()
                .requestMatchers("/ws/live-chat/**").permitAll()
                .requestMatchers("/error").permitAll()
                .requestMatchers("/api/staff/**").hasAnyAuthority("ROLE_ADMIN", "ROLE_1")
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new LegacyPasswordEncoder();
    }

    @Bean
    public DaoAuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration localAuthApi = new CorsConfiguration();
        localAuthApi.setAllowedOriginPatterns(parseCsv(allowedOriginPatterns));
        localAuthApi.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        localAuthApi.setAllowedHeaders(List.of("*"));
        localAuthApi.setExposedHeaders(List.of("Authorization"));
        localAuthApi.setAllowCredentials(true);

        CorsConfiguration widgetPublic = new CorsConfiguration();
        widgetPublic.setAllowedOriginPatterns(List.of("*"));
        widgetPublic.setAllowedMethods(List.of("GET", "POST", "OPTIONS"));
        widgetPublic.setAllowedHeaders(List.of("*"));
        widgetPublic.setAllowCredentials(false);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/crm/chats/widget/**", widgetPublic);
        source.registerCorsConfiguration("/api/public/astra/**", widgetPublic);
        source.registerCorsConfiguration("/api/public/chat/**", widgetPublic);
        source.registerCorsConfiguration("/api/chat-project-api/**", widgetPublic);
        source.registerCorsConfiguration("/ws/live-chat/**", widgetPublic);
        source.registerCorsConfiguration("/**", localAuthApi);
        return source;
    }

    private List<String> parseCsv(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }

        return List.of(value.split(",")).stream()
            .map(String::trim)
            .filter(item -> !item.isBlank())
            .toList();
    }
}
