FROM eclipse-temurin:17-jdk AS build
WORKDIR /workspace

COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -B -DskipTests dependency:go-offline

COPY src src
RUN ./mvnw -B -DskipTests package

FROM eclipse-temurin:17-jre
WORKDIR /app

ENV SERVER_PORT=8080
ENV TRAINING_ASSETS_DIR=/app/data/training-assets

RUN useradd --system --create-home --home-dir /app appuser
COPY --from=build /workspace/target/*.jar /app/app.jar
RUN mkdir -p /app/data/training-assets && chown -R appuser:appuser /app

USER appuser
VOLUME ["/app/data"]
EXPOSE 8080

ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app/app.jar"]
