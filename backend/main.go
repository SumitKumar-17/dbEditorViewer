package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/dbeditorviewer/backend/internal/api"
	"github.com/dbeditorviewer/backend/internal/db"
	"github.com/dbeditorviewer/backend/internal/store"
)

func main() {
	// Initialize the connection store
	connStore, err := store.DefaultStore()
	if err != nil {
		log.Fatalf("Failed to initialize connection store: %v", err)
	}

	// Create the connection manager
	manager := db.NewManager()

	// Load saved connections and attempt to reconnect each one
	savedConns, err := connStore.Load()
	if err != nil {
		log.Printf("Warning: failed to load saved connections: %v", err)
	} else {
		for _, conn := range savedConns {
			log.Printf("Attempting to reconnect: %s (%s)", conn.Name, conn.Type)
			if err := manager.Connect(&conn); err != nil {
				// Non-fatal: log and continue
				log.Printf("  Warning: could not reconnect %s: %v", conn.Name, err)
			} else {
				log.Printf("  Connected: %s", conn.Name)
			}
		}
	}

	// Set Gin mode
	if os.Getenv("GIN_MODE") == "" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Set up the router
	router := api.SetupRouter(manager, connStore)

	// Configure the HTTP server
	srv := &http.Server{
		Addr:         ":3001",
		Handler:      router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Start the server in a goroutine
	go func() {
		log.Printf("DB Editor backend listening on http://localhost:3001")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	// Wait for interrupt signal for graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	// Disconnect all active connections
	manager.DisconnectAll()

	// Give outstanding requests up to 10 seconds to complete
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited")
}
