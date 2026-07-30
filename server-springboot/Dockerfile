# ================================================
# Multi-stage Dockerfile for Java 21 Spring Boot
# ================================================

# Stage 1: Build stage with Maven & JDK 21
FROM maven:3.9.6-eclipse-temurin-21-alpine AS build
WORKDIR /app

# Cache dependencies
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copy source code and build production JAR
COPY src ./src
RUN mvn clean package -DskipTests

# Stage 2: Minimal Runtime stage with OpenJDK 21 JRE
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Set non-root security user
RUN addgroup -S spring && adduser -S spring -G spring
USER spring:spring

# Copy built JAR from build stage
COPY --from=build /app/target/*.jar app.jar

# Expose port
EXPOSE 5000

# Environment variables
ENV PORT=5000
ENV JAVA_OPTS="-Xms256m -Xmx512m"

# Launch Spring Boot application
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -Dserver.port=${PORT} -jar app.jar"]
